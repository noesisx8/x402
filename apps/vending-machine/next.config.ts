import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Monorepo / multi-lockfile machines (pikatop has ~/package-lock.json)
  outputFileTracingRoot: path.join(appDir, "../.."),
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  // The shared guard is TypeScript authored for NodeNext (imports end in .js).
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;