import Link from "next/link";
import { buttonVariants } from "@repo/ui/button";

const HACKATHON_SPONSORS = [
  { name: "OpenAI", src: "/sponsors/openai.svg" },
  { name: "Cloudflare", src: "/sponsors/cloudflare.svg" },
  { name: "Vercel", src: "/sponsors/vercel.svg" },
  { name: "Render", src: "/sponsors/render.svg" },
  { name: "Netlify", src: "/sponsors/netlify.svg" },
  { name: "Shopify", src: "/sponsors/shopify.svg" },
  { name: "Google Chrome", src: "/sponsors/googlechrome.svg" },
] as const;

export function RootHome() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 p-6">
        <h1 className="shrink-0 text-3xl font-medium">Root</h1>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <img
            src="/root-tree.png"
            alt="Root connecting Catalog, Customers, Cases, and Lab"
            className="max-h-full w-auto max-w-full object-contain"
          />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3 text-center">
          <p className="text-base text-muted-foreground">
            A desktop where a person and an agent share the same live apps.
            Catalog, Customers, and Cases stay on stage as real sites. The
            agent uses only the tools those pages expose. Writes wait for you.
            Take control stops the agent.
          </p>
          <span>
            <Link href="/sign-in" className={buttonVariants()}>
              Sign in
            </Link>
          </span>
          <p className="text-sm text-muted-foreground">
            Built for the{" "}
            <a
              href="https://webmcp.devpost.com/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              WebMCP Challenge
            </a>
            .
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            {HACKATHON_SPONSORS.map((sponsor) => (
              <li key={sponsor.name}>
                <img
                  src={sponsor.src}
                  alt={sponsor.name}
                  title={sponsor.name}
                  className="h-5 w-auto"
                />
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
