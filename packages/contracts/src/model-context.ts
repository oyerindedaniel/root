export type ModelContextAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

export type ModelContextTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: unknown;
  annotations?: ModelContextAnnotations;
  execute: (
    input: unknown,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

export type RegisteredTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: unknown;
  origin: string;
  window?: Window;
  annotations?: ModelContextAnnotations;
};

export type ModelContext = {
  addEventListener?: EventTarget["addEventListener"];
  removeEventListener?: EventTarget["removeEventListener"];
  registerTool: (
    tool: ModelContextTool,
    options?: { exposedTo?: string[]; signal?: AbortSignal },
  ) => Promise<void>;
  getTools: (options?: { fromOrigins?: string[] }) => Promise<RegisteredTool[]>;
  executeTool: (
    tool: RegisteredTool,
    input?: unknown,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}
