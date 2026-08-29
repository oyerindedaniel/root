export function requirePublicEnv(
  name: string,
  value: string | undefined,
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Set ${name} in the app .env.local (see .env.example).`);
  }
  return trimmed;
}

export const apiUpstreamUrl = requirePublicEnv(
  "NEXT_PUBLIC_API_URL",
  process.env.NEXT_PUBLIC_API_URL,
).replace(/\/$/, "");

export const apiBaseUrl = apiUpstreamUrl;

export const trpcHttpUrl = "/api/trpc";

export const trpcUpstreamHttpUrl = `${apiUpstreamUrl}/api/trpc`;
