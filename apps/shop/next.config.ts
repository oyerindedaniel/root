import type { NextConfig } from "next";

import { apiUpstreamUrl, requirePublicEnv } from "@repo/api-client/env";

const rootOrigin = requirePublicEnv(
  "NEXT_PUBLIC_ROOT_ORIGIN",
  process.env.NEXT_PUBLIC_ROOT_ORIGIN,
);

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
            key: "Content-Security-Policy",
            value: `frame-ancestors ${rootOrigin}`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
