"use client";

import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

const sameOriginHref =
  "https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy";
const frameAncestorsHref =
  "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors";

function MdLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-white/80 underline decoration-white/25 underline-offset-2 hover:text-white"
    >
      {children}
    </a>
  );
}

export function ProviderGuidePanel() {
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-sm text-white/60">
        Hand the file to the agent that owns that site. You only add the URL
        and grant tools in Apps.
      </p>
      <ul className="flex flex-col gap-2 text-sm text-white/60">
        <li>
          Root cannot read that page’s DOM, cookies, or storage.{" "}
          <MdLink href={sameOriginHref}>Same-origin policy</MdLink>
          {" · "}
          <MdLink href={frameAncestorsHref}>frame-ancestors</MdLink>
        </li>
        <li>
          Root can only run tools that page registered and exposed. Those
          tools run as that site.
        </li>
        <li>
          In Apps, Test the site, then grant only tools you would let an
          assistant call. Skip admin dumps and anything that returns secrets.
        </li>
      </ul>
      <a
        href="/custom-provider.md"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-xl bg-white/6 p-3 ring-1 ring-white/10 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[22%] bg-black/25 ring-1 ring-white/12">
          <ArrowDownTrayIcon className="size-5 text-white/80" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-white">
            custom-provider.md
          </span>
          <span className="block text-xs text-white/45">
            Opens in a new tab. Copy and hand to an agent.
          </span>
        </span>
      </a>
    </div>
  );
}
