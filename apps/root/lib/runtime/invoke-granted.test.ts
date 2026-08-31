import { describe, expect, it, vi } from "vitest";

import {
  boundedError,
  boundedSuccess,
  WEBMCP_MAX_RESULT_CHARS,
  type ModelContext,
  type NormalizedToolDescriptor,
  type RegisteredTool,
} from "@repo/contracts";

import { createProviderCatalog } from "@/lib/providers/catalog";
import { loadProviderDirectory } from "@/lib/providers/directory";
import {
  createDefaultWorkspacePreferences,
  type CustomProvider,
} from "@/lib/storage/workspace-preferences";

import {
  invokeGrantedTool,
  type InvokeGrantedDependencies,
} from "./invoke-granted";
import { runtimeReducer } from "./reducer";
import { createInitialRuntimeState } from "./state";

const account = { id: "user_1", email: "dev@localhost", name: "Dev" };
const directory = loadProviderDirectory({
  NEXT_PUBLIC_ROOT_ORIGIN: "http://localhost:3000",
  NEXT_PUBLIC_SHOP_ORIGIN: "http://localhost:3002",
  NEXT_PUBLIC_SHOP_ENTRY_URL: "http://localhost:3002/",
  NEXT_PUBLIC_ACCOUNTS_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_ACCOUNTS_ENTRY_URL: "http://localhost:3001/",
  NEXT_PUBLIC_SUPPORT_ORIGIN: "http://localhost:3003",
  NEXT_PUBLIC_SUPPORT_ENTRY_URL: "http://localhost:3003/",
});
const provider: CustomProvider = {
  id: "custom-provider-1",
  label: "Analytics",
  origin: "https://analytics.example",
  entryUrl: "https://analytics.example/app",
  icon: "data:image/webp;base64,AAAA",
  source: "custom",
  capability: "discovery-only",
  grantedTools: ["read_report"],
};
const preferences = {
  ...createDefaultWorkspacePreferences(),
  customProviders: [provider],
};
const catalog = createProviderCatalog(directory, preferences);
const handle: RegisteredTool = {
  name: "read_report",
  origin: provider.origin,
  inputSchema: {},
};

function descriptor(
  overrides: Partial<NormalizedToolDescriptor> = {},
): NormalizedToolDescriptor {
  return {
    providerId: provider.id,
    namespacedName: `${provider.id}.read_report`,
    name: "read_report",
    title: "Read report",
    description: "Read report",
    origin: provider.origin,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
    schemaFingerprint: "{}",
    invokeKind: "object",
    readOnlyHint: true,
    untrustedContentHint: false,
    ...overrides,
  };
}

function readyState(
  tool = descriptor(),
  origin = provider.origin,
  entryUrl = provider.entryUrl,
) {
  let state = createInitialRuntimeState(account);
  state = runtimeReducer(state, {
    type: "provider/mount",
    providerId: provider.id,
    instanceId: "custom_1",
    origin,
    entryUrl,
    openedBy: "agent",
    touchedAt: 1,
  });
  state = runtimeReducer(state, {
    type: "provider/loaded",
    instanceId: "custom_1",
  });
  return runtimeReducer(state, {
    type: "provider/ready",
    instanceId: "custom_1",
    tools: [tool],
  });
}

function setup(options: {
  state?: ReturnType<typeof readyState>;
  discoveredTool?: NormalizedToolDescriptor;
  modelContext?: ModelContext | null;
  executeTool?: () => Promise<string>;
  handle?: RegisteredTool | null;
  acquireOperation?: () => (() => void) | null;
} = {}) {
  let state = options.state ?? readyState(options.discoveredTool);
  const discover = vi.fn(async () => {
    if (options.discoveredTool) {
      state = readyState(options.discoveredTool);
    }
    return boundedSuccess({
      providerId: provider.id,
      origin: provider.origin,
      contractVersion: null,
      tools: state.windows.custom_1?.discoveredTools ?? [],
    });
  });
  const defaultModelContext =
    (Object.assign(new EventTarget(), {
      registerTool: async () => undefined,
      getTools: async () => [],
      executeTool: async () => undefined,
    }) satisfies ModelContext);
  const modelContext =
    options.modelContext === null
      ? undefined
      : (options.modelContext ?? defaultModelContext);
  const releaseOperation = vi.fn();
  const acquireOperation = vi.fn(
    options.acquireOperation ?? (() => releaseOperation),
  );
  const getHandle = vi.fn(
    () => options.handle === null ? undefined : (options.handle ?? handle),
  );
  const dependencies: InvokeGrantedDependencies = {
    catalog,
    acquireOperation,
    getState: () => state,
    discover,
    getHandle,
    getModelContext: () => modelContext,
    executeTool:
      options.executeTool ??
      (async () => JSON.stringify({ rows: [{ id: "r1" }] })),
  };
  return {
    discover,
    getState: () => state,
    acquireOperation,
    getHandle,
    releaseOperation,
    dependencies,
  };
}

function invoke(
  dependencies: ReturnType<typeof setup>["dependencies"],
  overrides: Partial<{
    providerId: string;
    tool: string;
    arguments: Record<string, unknown>;
  }> = {},
  signal = new AbortController().signal,
) {
  return invokeGrantedTool({
    input: {
      providerId: provider.id,
      tool: "read_report",
      arguments: { query: "ada" },
      ...overrides,
    },
    signal,
    dependencies,
  });
}

describe("invokeGrantedTool", () => {
  it("rediscovers, validates, executes, and returns separate untrusted data", async () => {
    const current = setup();
    const workflow = current.getState().workflow;
    await expect(invoke(current.dependencies)).resolves.toEqual({
      status: "success",
      data: {
        providerId: provider.id,
        tool: "read_report",
        untrusted: true,
        data: { rows: [{ id: "r1" }] },
      },
    });
    expect(current.discover).toHaveBeenCalledOnce();
    expect(current.getHandle).toHaveBeenCalledWith(
      "custom_1",
      provider.origin,
      "read_report",
    );
    expect(current.releaseOperation).toHaveBeenCalledOnce();
    expect(current.getState().workflow).toBe(workflow);
  });

  it("rejects unknown, built-in, and ungranted providers before leasing", async () => {
    const current = setup();
    await expect(
      invoke(current.dependencies, { providerId: "custom-missing" }),
    ).resolves.toMatchObject({
      status: "error",
      code: "unknown_provider",
    });
    await expect(
      invoke(current.dependencies, { providerId: "shop" }),
    ).resolves.toMatchObject({
      status: "error",
      code: "provider_not_invokable",
    });
    await expect(
      invoke(current.dependencies, { tool: "delete_report" }),
    ).resolves.toMatchObject({ status: "error", code: "tool_not_granted" });
    expect(current.discover).not.toHaveBeenCalled();
    expect(current.acquireOperation).not.toHaveBeenCalled();
  });

  it("rejects concurrent operations after verifying the grant", async () => {
    const current = setup({ acquireOperation: () => null });
    await expect(invoke(current.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "operation_in_progress",
    });
    expect(current.discover).not.toHaveBeenCalled();
  });

  it("rejects missing tools and origin drift after discovery", async () => {
    const missing = setup({
      state: readyState(descriptor({ name: "renamed_report" })),
    });
    await expect(invoke(missing.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "tool_not_found",
    });
    const drifted = setup({ state: readyState(descriptor(), "https://evil.example") });
    await expect(invoke(drifted.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "revalidation_failed",
    });
    const changedEntry = setup({
      state: readyState(
        descriptor(),
        provider.origin,
        "https://analytics.example/other",
      ),
    });
    await expect(invoke(changedEntry.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "revalidation_failed",
    });
  });

  it("preserves a bounded discovery failure and releases the lease", async () => {
    const current = setup();
    current.dependencies.discover = async () =>
      boundedError("discovery_failed", "Discovery failed.");
    await expect(invoke(current.dependencies)).resolves.toEqual({
      status: "error",
      code: "discovery_failed",
      message: "Discovery failed.",
    });
    expect(current.releaseOperation).toHaveBeenCalledOnce();
  });

  it("rejects unavailable WebMCP, oversized output, and malformed output", async () => {
    const unavailable = setup({ modelContext: null });
    await expect(invoke(unavailable.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "webmcp_unavailable",
    });
    const oversized = setup({
      executeTool: async () => `"${"x".repeat(WEBMCP_MAX_RESULT_CHARS)}"`,
    });
    await expect(invoke(oversized.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "output_too_large",
    });
    const malformed = setup({ executeTool: async () => "{" });
    await expect(invoke(malformed.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "execution_failed",
    });
  });

  it("rejects invalid live schemas, mismatched arguments, and stale handles", async () => {
    const invalidSchema = setup({
      discoveredTool: descriptor({ inputSchema: { type: "unknown" } }),
    });
    await expect(invoke(invalidSchema.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "invalid_schema",
    });
    const invalidArguments = setup();
    await expect(
      invoke(invalidArguments.dependencies, { arguments: { query: 1 } }),
    ).resolves.toMatchObject({
      status: "error",
      code: "invalid_arguments",
    });
    const staleHandle = setup({ handle: null });
    await expect(invoke(staleHandle.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "stale_handle",
    });
  });

  it("returns execution failure without classifying it as cancellation", async () => {
    const current = setup({
      executeTool: async () => {
        throw new Error("network failed");
      },
    });
    await expect(invoke(current.dependencies)).resolves.toMatchObject({
      status: "error",
      code: "execution_failed",
    });
    expect(current.releaseOperation).toHaveBeenCalledOnce();
  });

  it("returns cancelled when discovery aborts", async () => {
    const current = setup();
    const controller = new AbortController();
    current.dependencies.discover = async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    };
    await expect(
      invoke(current.dependencies, {}, controller.signal),
    ).resolves.toMatchObject({ status: "error", code: "cancelled" });
  });
});
