import type { NextConfig } from "next";

import { apiUpstreamUrl } from "@repo/api-client/env";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui", "@repo/api-client"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUpstreamUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
