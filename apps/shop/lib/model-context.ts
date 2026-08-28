export function getDocumentModelContext(doc: Document) {
  if (!("modelContext" in doc)) {
    return null;
  }
  const modelContext = (
    doc as Document & {
      modelContext?: {
        registerTool: (
          tool: {
            name: string;
            title?: string;
            description?: string;
            inputSchema: unknown;
            annotations?: {
              readOnlyHint?: boolean;
              untrustedContentHint?: boolean;
            };
            execute: (
              input: unknown,
              options: { signal: AbortSignal },
            ) => Promise<unknown>;
          },
          options?: { exposedTo?: string[]; signal?: AbortSignal },
        ) => Promise<void>;
      };
    }
  ).modelContext;
  return modelContext ?? null;
}
