import {
  GatewayError,
  WEBMCP_DISCOVERY_POLL_MS,
  WEBMCP_DISCOVERY_TIMEOUT_MS,
  type ModelContext,
  type RegisteredTool,
} from "@repo/contracts";

export class DiscoveryTimeoutError extends GatewayError {
  constructor(message = "Provider tools were not discovered in time.") {
    super("discovery_timeout", message);
    this.name = "DiscoveryTimeoutError";
  }
}

export async function discoverTools(options: {
  modelContext: ModelContext;
  origin: string;
  discovery:
    | { mode: "builtin"; expectedNames: readonly string[] }
    | { mode: "custom" };
  signal: AbortSignal;
  timeoutMs?: number;
  pollMs?: number;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<RegisteredTool[]> {
  const timeoutMs = options.timeoutMs ?? WEBMCP_DISCOVERY_TIMEOUT_MS;
  const pollMs = options.pollMs ?? WEBMCP_DISCOVERY_POLL_MS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? sleepWithSignal;
  const deadline = now() + timeoutMs;
  const expected =
    options.discovery.mode === "builtin"
      ? new Set(options.discovery.expectedNames)
      : null;

  const match = async () => {
    const tools = await options.modelContext.getTools({
      fromOrigins: [options.origin],
    });
    return tools.filter((tool) => {
      if (tool.origin !== options.origin) {
        return false;
      }
      return expected ? expected.has(tool.name) : true;
    });
  };

  const addEventListener = options.modelContext.addEventListener?.bind(
    options.modelContext,
  );
  const removeEventListener = options.modelContext.removeEventListener?.bind(
    options.modelContext,
  );
  if (!addEventListener || !removeEventListener) {
    while (now() <= deadline) {
      options.signal.throwIfAborted();
      const found = await match();
      if (found.length >= (expected?.size ?? 1)) {
        return found;
      }
      if (now() + pollMs > deadline) {
        break;
      }
      await sleep(pollMs, options.signal);
    }
    throw new DiscoveryTimeoutError();
  }

  let revision = 0;
  let wake: (() => void) | null = null;
  const onToolChange = () => {
    revision += 1;
    wake?.();
  };
  addEventListener("toolchange", onToolChange);
  try {
    while (now() <= deadline) {
      options.signal.throwIfAborted();
      const matchedRevision = revision;
      const found = await match();
      if (found.length >= (expected?.size ?? 1)) {
        return found;
      }
      const remaining = deadline - now();
      if (remaining <= 0) {
        break;
      }
      if (revision !== matchedRevision) {
        continue;
      }
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: unknown) => {
          clearTimeout(timer);
          options.signal.removeEventListener("abort", onAbort);
          wake = null;
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        };
        const onAbort = () => {
          finish(
            options.signal.reason ??
              new DOMException("Aborted", "AbortError"),
          );
        };
        const timer = setTimeout(finish, remaining);
        wake = () => finish();
        if (options.signal.aborted) {
          onAbort();
        } else {
          options.signal.addEventListener("abort", onAbort, { once: true });
        }
      });
    }
  } finally {
    removeEventListener("toolchange", onToolChange);
  }

  throw new DiscoveryTimeoutError();
}

async function sleepWithSignal(ms: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
