"use client";

import { useTRPCClient } from "@repo/api-client";
import { requirePublicEnv } from "@repo/api-client/env";
import {
  CREATE_PRODUCT_INPUT_SCHEMA,
  OPEN_PRODUCT_INPUT_SCHEMA,
  SEARCH_PRODUCTS_INPUT_SCHEMA,
  createDocumentVisibilityGate,
  createProductInputSchema,
  createProductOutputSchema,
  openProductOutputSchema,
  parseToolExecuteInput,
  portableProductReference,
  productIdInputSchema,
  searchProductsInputSchema,
  searchProductsOutputSchema,
} from "@repo/contracts";
import { useToolPresent } from "@repo/ui/tool-present";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from "react";

const rootOrigin = requirePublicEnv(
  "NEXT_PUBLIC_ROOT_ORIGIN",
  process.env.NEXT_PUBLIC_ROOT_ORIGIN,
);

type SearchSurface = {
  queryInput: HTMLInputElement | null;
  setQuery: (value: string) => void;
  runSearch: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<ReturnType<typeof searchProductsOutputSchema.parse>>;
};

type CreateSurface = {
  nameInput: HTMLInputElement | null;
  descriptionInput: HTMLInputElement | null;
  priceInput: HTMLInputElement | null;
  setName: (value: string) => void;
  setDescription: (value: string) => void;
  setPriceUsd: (value: string) => void;
};

type DetailSurface = {
  id: string;
};

type WorkspaceValue = {
  present: ReturnType<typeof useToolPresent>;
  registerSearch: (surface: SearchSurface) => () => void;
  registerCreate: (surface: CreateSurface) => () => void;
  registerDetail: (surface: DetailSurface) => () => void;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("Workspace is not mounted.");
  }
  return value;
}

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof DOMException) {
    return signal.reason;
  }
  return new DOMException("Aborted", "AbortError");
}

function makeSlot<T>() {
  let current: T | null = null;
  const waiters = new Set<(value: T) => void>();
  return {
    register(value: T) {
      current = value;
      for (const waiter of [...waiters]) {
        waiter(value);
      }
      return () => {
        if (current === value) {
          current = null;
        }
      };
    },
    waitUntil(match: (value: T) => boolean, signal: AbortSignal) {
      if (current && match(current)) {
        return Promise.resolve(current);
      }
      return new Promise<T>((resolve, reject) => {
        if (signal.aborted) {
          reject(abortError(signal));
          return;
        }
        const waiter = (value: T) => {
          if (!match(value)) {
            return;
          }
          waiters.delete(waiter);
          signal.removeEventListener("abort", onAbort);
          resolve(value);
        };
        const onAbort = () => {
          waiters.delete(waiter);
          reject(abortError(signal));
        };
        waiters.add(waiter);
        signal.addEventListener("abort", onAbort, { once: true });
      });
    },
  };
}

export function WorkspaceShell({ children }: PropsWithChildren) {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const visibilityGateRef = useRef(createDocumentVisibilityGate());
  const present = useToolPresent({
    rootOrigin,
    gate: visibilityGateRef.current,
  });
  const routerRef = useRef(router);
  routerRef.current = router;
  const searchSlot = useRef(makeSlot<SearchSurface>()).current;
  const createSlot = useRef(makeSlot<CreateSurface>()).current;
  const detailSlot = useRef(makeSlot<DetailSurface>()).current;

  const registerSearch = useCallback(
    (surface: SearchSurface) => searchSlot.register(surface),
    [searchSlot],
  );
  const registerCreate = useCallback(
    (surface: CreateSurface) => createSlot.register(surface),
    [createSlot],
  );
  const registerDetail = useCallback(
    (surface: DetailSurface) => detailSlot.register(surface),
    [detailSlot],
  );

  const value = useMemo(
    () => ({
      present,
      registerSearch,
      registerCreate,
      registerDetail,
    }),
    [present, registerSearch, registerCreate, registerDetail],
  );

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void modelContext.registerTool(
      {
        name: "search_products",
        title: "Search products",
        description:
          "Searches the catalog and visibly displays matching products.",
        inputSchema: SEARCH_PRODUCTS_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = searchProductsInputSchema.parse(
            parseToolExecuteInput(input),
          );
          routerRef.current.push("/");
          const search = await searchSlot.waitUntil(() => true, signal);
          present.arm();
          present.setCoedit(true);
          try {
            const filled = await present.fill({
              text: parsed.query,
              setValue: search.setQuery,
              input: search.queryInput,
              signal,
            });
            if (filled?.yielded) {
              await present.waitForPersist({ signal });
            } else {
              await present.preview({ signal });
              const live =
                search.queryInput?.value ?? filled?.text ?? parsed.query;
              if (filled && live !== filled.text) {
                await present.waitForPersist({ signal });
              }
            }
            signal.throwIfAborted();
            present.setCoedit(false);
            const submitted =
              search.queryInput?.value ?? filled?.text ?? parsed.query;
            const result = await search.runSearch(submitted, signal);
            const selectedId = await present.waitForSelect({
              candidateId: result.products[0]?.id ?? null,
              signal,
            });
            const hit = result.products.find(
              (product) => product.id === selectedId,
            );
            present.commit(selectedId ?? result.products[0]?.id ?? null);
            return {
              ...result,
              ...(selectedId ? { selectedId } : {}),
              ...(hit
                ? {
                    selected: portableProductReference(
                      hit,
                      new Date().toISOString(),
                    ),
                  }
                : {}),
            };
          } catch (caught) {
            present.commit(null);
            throw caught;
          } finally {
            present.setCoedit(false);
          }
        },
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    void modelContext.registerTool(
      {
        name: "open_product",
        title: "Open product",
        description: "Opens a product record on this page.",
        inputSchema: OPEN_PRODUCT_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = productIdInputSchema.parse(
            parseToolExecuteInput(input),
          );
          const result = openProductOutputSchema.parse(
            await trpcClient.v1.shop.getProduct.query(parsed, { signal }),
          );
          routerRef.current.push(`/products/${result.product.id}`);
          await detailSlot.waitUntil(
            (surface) => surface.id === result.product.id,
            signal,
          );
          return result;
        },
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    void modelContext.registerTool(
      {
        name: "create_product",
        title: "Create product",
        description:
          "Fills a new product form. A human must click Create; this tool does not submit the write itself.",
        inputSchema: CREATE_PRODUCT_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = createProductInputSchema.parse(
            parseToolExecuteInput(input),
          );
          if (!visibilityGateRef.current.shouldPresent()) {
            throw new Error(
              "create_product requires the Catalog window on stage.",
            );
          }
          routerRef.current.push("/products/new");
          const form = await createSlot.waitUntil(() => true, signal);
          present.arm();
          present.setCoedit(true);
          try {
            const filledName = await present.fill({
              text: parsed.name,
              setValue: form.setName,
              input: form.nameInput,
              signal,
            });
            if (!filledName?.yielded) {
              const filledDescription = await present.fill({
                text: parsed.description,
                setValue: form.setDescription,
                input: form.descriptionInput,
                signal,
              });
              if (!filledDescription?.yielded) {
                await present.fill({
                  text: String(parsed.priceUsd),
                  setValue: form.setPriceUsd,
                  input: form.priceInput,
                  signal,
                });
              }
            }
            await present.waitForPersist({ signal });
            signal.throwIfAborted();
            if (!visibilityGateRef.current.shouldPresent()) {
              throw new Error(
                "create_product requires the Catalog window on stage.",
              );
            }
            present.setCoedit(false);
            const live = createProductInputSchema.parse({
              name: form.nameInput?.value ?? parsed.name,
              description: form.descriptionInput?.value ?? parsed.description,
              priceUsd: Number.parseInt(
                form.priceInput?.value ?? String(parsed.priceUsd),
                10,
              ),
            });
            const result = createProductOutputSchema.parse(
              await trpcClient.v1.shop.createProduct.mutate(live, { signal }),
            );
            routerRef.current.push(`/products/${result.product.id}`);
            await detailSlot.waitUntil(
              (surface) => surface.id === result.product.id,
              signal,
            );
            return result;
          } finally {
            present.setCoedit(false);
          }
        },
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    return () => controller.abort();
  }, [
    createSlot,
    detailSlot,
    present.arm,
    present.commit,
    present.fill,
    present.preview,
    present.setCoedit,
    present.waitForPersist,
    present.waitForSelect,
    searchSlot,
    trpcClient,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
