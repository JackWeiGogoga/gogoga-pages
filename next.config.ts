import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "110mb"
    }
  }
};

export default nextConfig;
