import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Camera beta: the empty-mat snapshot goes up through a server action.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
