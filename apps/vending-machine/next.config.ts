import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
};

export default nextConfig;