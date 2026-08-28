export const SIGN_IN_PATH = "/sign-in";

export function parseReturnPath(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) {
    return "/";
  }
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/";
  }
  if (raw.includes("://") || raw.includes("\\")) {
    return "/";
  }
  try {
    const url = new URL(raw, "http://root.local");
    if (url.username || url.password || url.host !== "root.local") {
      return "/";
    }
    const path = `${url.pathname}${url.search}`;
    if (path === SIGN_IN_PATH || path.startsWith(`${SIGN_IN_PATH}?`)) {
      return "/";
    }
    return path || "/";
  } catch {
    return "/";
  }
}

export function buildSignInHref(fromPath = "/"): string {
  const safe = parseReturnPath(fromPath);
  if (safe === "/") {
    return SIGN_IN_PATH;
  }
  return `${SIGN_IN_PATH}?from=${encodeURIComponent(safe)}`;
}
