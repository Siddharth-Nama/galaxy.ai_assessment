import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
      {
        protocol: "https",
        hostname: "assets.weavy.ai",
      },
      {
        protocol: "https",
        hostname: "pub-e8fef8c0e03b44acb340577811800829.r2.dev",
      },
    ],
  },
};

export default nextConfig;
