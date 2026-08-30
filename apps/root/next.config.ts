import type { NextConfig } from "next";

import { apiUpstreamUrl, requirePublicEnv } from "@repo/api-client/env";

const shopOrigin = requirePublicEnv(
  "NEXT_PUBLIC_SHOP_ORIGIN",
  process.env.NEXT_PUBLIC_SHOP_ORIGIN,
);
const accountsOrigin = requirePublicEnv(
  "NEXT_PUBLIC_ACCOUNTS_ORIGIN",
  process.env.NEXT_PUBLIC_ACCOUNTS_ORIGIN,
);
const supportOrigin = requirePublicEnv(
  "NEXT_PUBLIC_SUPPORT_ORIGIN",
  process.env.NEXT_PUBLIC_SUPPORT_ORIGIN,
);

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
            value: `tools=(self "${shopOrigin}" "${accountsOrigin}" "${supportOrigin}")`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
