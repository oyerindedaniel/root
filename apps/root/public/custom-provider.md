# Root custom provider

Hand this to an agent adding a site as a custom provider in Root.

Root lives at `https://root.danieloyerinde.com`. It loads the site in an iframe (`allow="tools"`) and lists WebMCP tools on that document. Custom tools are not prepare_workflow steps. After Root’s Test, a human grants tools before invoke.

## Boundary

The iframe is cross-origin. Root cannot read the page DOM, cookies, or storage. Do not add iframe sandbox for that; it is already the browser rule.

- Same-origin policy: https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
- CSP frame-ancestors: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors

Register only tools meant for the agent. `execute` should return only what that agent is meant to see. Expose them to Root only.

## Embed

Root must be allowed to frame the page.

```
Content-Security-Policy: frame-ancestors https://root.danieloyerinde.com;
```

Do not send `X-Frame-Options: DENY` or `SAMEORIGIN`.

## Tools

Register on the live document with WebMCP (`document.modelContext.registerTool`). Expose tools to Root only:

```
exposedTo: ["https://root.danieloyerinde.com"]
```

Register from a shell that stays mounted across client navigations. Page-only registration aborts when the route changes.

Tool names: `^[A-Za-z0-9_.-]+$`, 1–128 characters. Discover needs at least one registered tool. Keep the set small. Do not register admin dumps, raw query, or anything that returns secrets unless the human will grant that on purpose.

## Add in Root

Apps → Add provider.

- Origin: site origin, no path. Example: `https://lab.danieloyerinde.com`
- Entry URL: the page Root should load. Example: `https://lab.danieloyerinde.com/`

Needs Chrome with WebMCP. Codex’s in-app browser cannot see those tools.
