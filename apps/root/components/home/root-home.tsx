import Link from "next/link";
import { buttonVariants } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/cn";

import { preloadDesktopAssets } from "@/lib/desktop/preload-assets";

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
  preloadDesktopAssets();
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <main className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 p-6">
        <div className="relative flex shrink-0 items-center justify-center">
          <h1 className="text-3xl font-medium">Root</h1>
          <a
            href="https://github.com/oyerindedaniel/root"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "absolute top-1/2 left-full ml-1.5 -translate-y-1/2 px-2",
            )}
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
              className="size-5"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </a>
        </div>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center">
          <img
            src="/root-tree.png"
            alt="Root connecting Catalog, Customers, Cases, and Lab"
            className="max-h-full w-auto max-w-full object-contain"
          />
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3 text-center">
          <p className="text-base text-muted-foreground">
            A workspace where a person and an agent share the same live apps.
            Catalog, Customers, and Cases stay on stage as real sites. The
            agent uses only the tools those pages expose. Writes, search picks,
            and a field you take over wait for you. Take control stops the
            agent.
          </p>
          <span>
            <Link href="/sign-in" className={buttonVariants()}>
              Sign in
            </Link>
          </span>
          <p className="text-sm text-muted-foreground">
            Built for the{" "}
            <a
              href="https://openai.com/webmcp-challenge/"
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
