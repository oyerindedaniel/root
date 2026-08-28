import {
  WEBMCP_DISCOVERY_POLL_MS,
  WEBMCP_DISCOVERY_TIMEOUT_MS,
} from "@repo/contracts";

import type { ModelContext, RegisteredTool } from "./model-context";

export class DiscoveryTimeoutError extends Error {
  constructor() {
    super("Provider tools were not discovered in time.");
    this.name = "DiscoveryTimeoutError";
  }
}

export async function discoverTools(options: {
  modelContext: ModelContext;
  origin: string;
  expectedNames: readonly string[];
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
  const expected = new Set(options.expectedNames);

  const match = async () => {
    const tools = await options.modelContext.getTools({
      fromOrigins: [options.origin],
    });
    return tools.filter(
      (tool) => tool.origin === options.origin && expected.has(tool.name),
    );
  };

  const onToolChange = () => undefined;
  options.modelContext.addEventListener("toolchange", onToolChange);

  try {
    while (now() <= deadline) {
      options.signal.throwIfAborted();
      const found = await match();
      if (found.length >= expected.size) {
        return found;
      }
      if (now() + pollMs > deadline) {
        break;
      }
      await sleep(pollMs, options.signal);
    }
  } finally {
    options.modelContext.removeEventListener("toolchange", onToolChange);
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
