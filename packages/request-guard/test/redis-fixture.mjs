/** Disposable real Redis + minimal REST transport. Requires redis-server and redis-cli on PATH. */
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
const exec = promisify(execFile);

export async function startRedisFixture() {
  const dir = await mkdtemp(join(tmpdir(), "x402-redis-"));
  const socket = join(dir, "redis.sock");
  const child = spawn("redis-server", ["--port", "0", "--unixsocket", socket,
    "--save", "", "--appendonly", "no", "--dir", dir], { stdio: "ignore" });
  let startupError;
  child.on("error", (error) => { startupError = error; });
  const command = async (...args) => {
    const { stdout } = await exec("redis-cli", ["-s", socket, "--json", ...args.map(String)]);
    return JSON.parse(stdout);
  };
  const server = createServer(async (req, res) => {
    try {
      let body = "";
      for await (const chunk of req) body += chunk;
      const result = await command(...JSON.parse(body));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ result }));
    } catch {
      res.statusCode = 503;
      res.end(JSON.stringify({ error: "fixture_store_unavailable" }));
    }
  });
  async function stop() {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
    if (child.exitCode === null && !startupError) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill("SIGTERM");
      await exited;
    }
    await rm(dir, { recursive: true, force: true });
  }
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error("redis_fixture_exited");
      try { ready = await command("PING") === "PONG"; } catch { /* wait for socket */ }
      if (ready) break;
      await delay(20);
    }
    if (!ready) throw new Error("redis_fixture_start_timeout");
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    return { url: `http://127.0.0.1:${server.address().port}`, command, stop };
  } catch (error) {
    await stop();
    throw new Error("Real Redis tests require redis-server and redis-cli on PATH", { cause: error });
  }
}
