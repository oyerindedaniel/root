import type { NextConfig } from "next";

import { apiUpstreamUrl } from "@repo/api-client/env";

const shopOrigin =
  process.env.NEXT_PUBLIC_SHOP_ORIGIN ?? "http://localhost:3002";

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
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: `tools=(self "${shopOrigin}")`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
