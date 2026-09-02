import type { NextConfig } from "next";

import { apiUpstreamUrl } from "@repo/api-client/env";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  transpilePackages: ["@repo/ui", "@repo/api-client"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiUpstreamUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "tools=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
