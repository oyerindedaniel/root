import { describe, expect, it, vi } from "vitest";

import type { ModelContext, RegisteredTool } from "@repo/contracts";

import { executeRegisteredTool } from "./execute";

const tool: RegisteredTool = {
  name: "search_products",
  origin: "http://localhost:3002",
  inputSchema: {},
};

describe("executeRegisteredTool", () => {
  it("calls executeTool once with a JSON string for Chrome", async () => {
    const executeTool = vi.fn(async (_tool: RegisteredTool, input: unknown) => {
      expect(input).toBe('{"query":"keyboard"}');
      return '{"status":"success"}';
    });
    const modelContext = {
      executeTool,
    } as unknown as ModelContext;

    await executeRegisteredTool({
      modelContext,
      tool,
      invokeKind: "json-string",
      input: { query: "keyboard" },
      signal: new AbortController().signal,
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
  });

  it("does not retry the other argument shape after failure", async () => {
    const executeTool = vi.fn(
      async (_tool: RegisteredTool, _input: unknown) => {
        void _tool;
        void _input;
        throw new Error("bad_input");
      },
    );
    const modelContext = {
      executeTool,
    } as unknown as ModelContext;

    await expect(
      executeRegisteredTool({
        modelContext,
        tool,
        invokeKind: "json-string",
        input: { query: "keyboard" },
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow("bad_input");

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(executeTool.mock.calls[0]?.[1]).toBe('{"query":"keyboard"}');
  });
});
