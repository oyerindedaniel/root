const apiUpstreamRaw = process.env.NEXT_PUBLIC_API_URL?.trim();
if (!apiUpstreamRaw) {
  throw new Error(
    "Set NEXT_PUBLIC_API_URL in the app .env.local (see .env.example).",
  );
}

export const apiUpstreamUrl = apiUpstreamRaw.replace(/\/$/, "");

export const apiBaseUrl = apiUpstreamUrl;

export const trpcHttpUrl = "/api/trpc";

export const trpcUpstreamHttpUrl = `${apiUpstreamUrl}/api/trpc`;
