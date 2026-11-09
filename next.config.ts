import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: [
    "192.168.137.1",
    "192.168.100.175",
    "127.0.0.1",
    "localhost",
  ],
};

export default nextConfig;
