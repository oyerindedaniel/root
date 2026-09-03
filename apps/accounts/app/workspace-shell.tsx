"use client";

import { useTRPCClient } from "@repo/api-client";
import { requirePublicEnv } from "@repo/api-client/env";
import {
  CREATE_CUSTOMER_INPUT_SCHEMA,
  OPEN_CUSTOMER_INPUT_SCHEMA,
  SELECT_RESULT_INPUT_SCHEMA,
  SEARCH_CUSTOMERS_INPUT_SCHEMA,
  createCustomerInputSchema,
  createCustomerOutputSchema,
  createDocumentVisibilityGate,
  customerIdInputSchema,
  openCustomerOutputSchema,
  parseToolExecuteInput,
  portableCustomerReference,
  selectResultOutputSchema,
  selectResultToolInputSchema,
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
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
  getCustomers: () => ReturnType<typeof searchCustomersOutputSchema.parse>["customers"];
  runSearch: (
    query: string,
    signal?: AbortSignal,
  ) => Promise<ReturnType<typeof searchCustomersOutputSchema.parse>>;
};

type CreateSurface = {
  nameInput: HTMLInputElement | null;
  emailInput: HTMLInputElement | null;
  setName: (value: string) => void;
  setEmail: (value: string) => void;
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
        name: "search_customers",
        title: "Search customers",
        description:
          "Searches the directory and visibly displays matching customers.",
        inputSchema: SEARCH_CUSTOMERS_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = searchCustomersInputSchema.parse(
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
            present.commit(null);
            return result;
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
        name: "select_result",
        title: "Select customer",
        description: "Selects one customer from the current search results.",
        inputSchema: SELECT_RESULT_INPUT_SCHEMA,
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = selectResultToolInputSchema.parse(parseToolExecuteInput(input));
          const source = searchCustomersOutputSchema.parse(parsed.source);
          const search = await searchSlot.waitUntil(() => true, signal);
          const customers = search.getCustomers();
          if (customers.length !== source.customers.length || source.customers.some((customer) => !customers.some((item) => item.id === customer.id))) {
            throw new Error("The selected source collection is no longer current.");
          }
          const candidate = customers[0];
          if (!candidate) {
            throw new Error("The source collection has no selectable customer.");
          }
          present.arm();
          try {
            const selectedId = customers.length === 1 ? candidate.id : await present.waitForSelect({ candidateId: candidate.id, signal });
            const selected = customers.find((customer) => customer.id === selectedId);
            if (!selected || !source.customers.some((customer) => customer.id === selected.id)) {
              throw new Error("The chosen customer is not in the source collection.");
            }
            present.commit(selected.id);
            return selectResultOutputSchema.parse({ selected: portableCustomerReference(selected, new Date().toISOString()) });
          } catch (caught) {
            present.commit(null);
            throw caught;
          }
        },
      },
      { exposedTo: [rootOrigin], signal: controller.signal },
    );
    void modelContext.registerTool(
      {
        name: "open_customer",
        title: "Open customer",
        description: "Opens a customer record on this page.",
        inputSchema: OPEN_CUSTOMER_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = customerIdInputSchema.parse(
            parseToolExecuteInput(input),
          );
          const result = openCustomerOutputSchema.parse(
            await trpcClient.v1.accounts.getCustomer.query(parsed, { signal }),
          );
          routerRef.current.push(`/customers/${result.customer.id}`);
          await detailSlot.waitUntil(
            (surface) => surface.id === result.customer.id,
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
        name: "open_customer_by_id",
        title: "Open customer by id",
        description: "Opens a customer record using an explicit customer id.",
        inputSchema: OPEN_CUSTOMER_INPUT_SCHEMA,
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = customerIdInputSchema.parse(parseToolExecuteInput(input));
          const result = openCustomerOutputSchema.parse(await trpcClient.v1.accounts.getCustomer.query(parsed, { signal }));
          routerRef.current.push(`/customers/${result.customer.id}`);
          await detailSlot.waitUntil((surface) => surface.id === result.customer.id, signal);
          return result;
        },
      },
      { exposedTo: [rootOrigin], signal: controller.signal },
    );
    void modelContext.registerTool(
      {
        name: "create_customer",
        title: "Create customer",
        description:
          "Fills a new customer form. A human must click Create; this tool does not submit the write itself.",
        inputSchema: CREATE_CUSTOMER_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = createCustomerInputSchema.parse(
            parseToolExecuteInput(input),
          );
          if (!visibilityGateRef.current.shouldPresent()) {
            throw new Error(
              "create_customer requires the Customers window on stage.",
            );
          }
          routerRef.current.push("/customers/new");
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
              await present.fill({
                text: parsed.email,
                setValue: form.setEmail,
                input: form.emailInput,
                signal,
              });
            }
            await present.waitForPersist({ signal });
            signal.throwIfAborted();
            if (!visibilityGateRef.current.shouldPresent()) {
              throw new Error(
                "create_customer requires the Customers window on stage.",
              );
            }
            present.setCoedit(false);
            const live = createCustomerInputSchema.parse({
              name: form.nameInput?.value ?? parsed.name,
              email: form.emailInput?.value ?? parsed.email,
            });
            const result = createCustomerOutputSchema.parse(
              await trpcClient.v1.accounts.createCustomer.mutate(live, {
                signal,
              }),
            );
            routerRef.current.push(`/customers/${result.customer.id}`);
            await detailSlot.waitUntil(
              (surface) => surface.id === result.customer.id,
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
