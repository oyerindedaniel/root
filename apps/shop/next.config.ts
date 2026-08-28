import type { NextConfig } from "next";

import { apiUpstreamUrl } from "@repo/api-client/env";

const rootOrigin =
  process.env.NEXT_PUBLIC_ROOT_ORIGIN ?? "http://localhost:3000";

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
            key: "Content-Security-Policy",
            value: `frame-ancestors ${rootOrigin}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
