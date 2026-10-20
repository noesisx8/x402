/**
 * Process entry. Import createApp from ./server.js in tests — this file binds a port.
 */
import { createApp, parseEnv } from "./server.js";

const env = parseEnv(process.env);
const app = await createApp(env);

app.listen(env.PORT, env.HOST, () => {
  console.log(`x402-api listening on ${env.HOST}:${env.PORT} (x402=${env.X402_ENABLED})`);
});
