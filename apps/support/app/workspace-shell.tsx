"use client";

import { useTRPCClient } from "@repo/api-client";
import { requirePublicEnv } from "@repo/api-client/env";
import {
  CREATE_CASE_INPUT_SCHEMA,
  OPEN_CASE_INPUT_SCHEMA,
  SEARCH_CASES_INPUT_SCHEMA,
  caseIdInputSchema,
  caseSearchText,
  createCaseInputSchema,
  createCaseOutputSchema,
  createDocumentVisibilityGate,
  openCaseOutputSchema,
  parseToolExecuteInput,
  portableCaseReference,
  searchCasesOutputSchema,
  searchCasesToolInputSchema,
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
  setBoundAsk: (value: string | null) => void;
  showEmptyBound: () => void;
  runSearch: (
    query: string,
    signal?: AbortSignal,
    keepField?: boolean,
  ) => Promise<ReturnType<typeof searchCasesOutputSchema.parse>>;
};

type CreateSurface = {
  titleInput: HTMLInputElement | null;
  customerNameInput: HTMLInputElement | null;
  customerEmailInput: HTMLInputElement | null;
  orderRefInput: HTMLInputElement | null;
  setTitle: (value: string) => void;
  setCustomerName: (value: string) => void;
  setCustomerEmail: (value: string) => void;
  setOrderRef: (value: string) => void;
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
        name: "search_cases",
        title: "Search cases",
        description:
          "Searches support projections and visibly displays matching cases.",
        inputSchema: SEARCH_CASES_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = searchCasesToolInputSchema.parse(
            parseToolExecuteInput(input),
          );
          routerRef.current.push("/");
          const search = await searchSlot.waitUntil(() => true, signal);
          present.arm();
          present.setCoedit(true);
          try {
            if (typeof parsed.query !== "string") {
              if (visibilityGateRef.current.shouldPresent()) {
                search.setBoundAsk(`Cases for ${parsed.query.displayName}`);
              }
              const text = caseSearchText(parsed.query);
              const result = text
                ? await search.runSearch(text, signal, true)
                : searchCasesOutputSchema.parse({
                    status: "success",
                    query: parsed.query,
                    cases: [],
                  });
              if (!text) {
                search.showEmptyBound();
              }
              const selectedId = await present.waitForSelect({
                candidateId: result.cases[0]?.id ?? null,
                signal,
              });
              const hit = result.cases.find(
                (supportCase) => supportCase.id === selectedId,
              );
              present.commit(selectedId ?? result.cases[0]?.id ?? null);
              return {
                ...result,
                query: parsed.query,
                ...(selectedId ? { selectedId } : {}),
                ...(hit
                  ? {
                      selected: portableCaseReference(
                        hit,
                        new Date().toISOString(),
                      ),
                    }
                  : {}),
              };
            }
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
              candidateId: result.cases[0]?.id ?? null,
              signal,
            });
            const hit = result.cases.find(
              (supportCase) => supportCase.id === selectedId,
            );
            present.commit(selectedId ?? result.cases[0]?.id ?? null);
            return {
              ...result,
              ...(selectedId ? { selectedId } : {}),
              ...(hit
                ? {
                    selected: portableCaseReference(
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
            search.setBoundAsk(null);
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
        name: "open_case",
        title: "Open case",
        description: "Opens a case record on this page.",
        inputSchema: OPEN_CASE_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = caseIdInputSchema.parse(parseToolExecuteInput(input));
          const result = openCaseOutputSchema.parse(
            await trpcClient.v1.support.getCase.query(parsed, { signal }),
          );
          routerRef.current.push(`/cases/${result.case.id}`);
          await detailSlot.waitUntil(
            (surface) => surface.id === result.case.id,
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
        name: "create_case",
        title: "Create case",
        description:
          "Fills a new case form. A human must click Create; this tool does not submit the write itself.",
        inputSchema: CREATE_CASE_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = createCaseInputSchema.parse(
            parseToolExecuteInput(input),
          );
          if (!visibilityGateRef.current.shouldPresent()) {
            throw new Error("create_case requires the Cases window on stage.");
          }
          routerRef.current.push("/cases/new");
          const form = await createSlot.waitUntil(() => true, signal);
          present.arm();
          present.setCoedit(true);
          try {
            const filledTitle = await present.fill({
              text: parsed.title,
              setValue: form.setTitle,
              input: form.titleInput,
              signal,
            });
            if (!filledTitle?.yielded) {
              const filledName = await present.fill({
                text: parsed.customerName,
                setValue: form.setCustomerName,
                input: form.customerNameInput,
                signal,
              });
              if (!filledName?.yielded) {
                const filledEmail = await present.fill({
                  text: parsed.customerEmail,
                  setValue: form.setCustomerEmail,
                  input: form.customerEmailInput,
                  signal,
                });
                if (!filledEmail?.yielded) {
                  await present.fill({
                    text: parsed.orderRef,
                    setValue: form.setOrderRef,
                    input: form.orderRefInput,
                    signal,
                  });
                }
              }
            }
            await present.waitForPersist({ signal });
            signal.throwIfAborted();
            if (!visibilityGateRef.current.shouldPresent()) {
              throw new Error(
                "create_case requires the Cases window on stage.",
              );
            }
            present.setCoedit(false);
            const live = createCaseInputSchema.parse({
              title: form.titleInput?.value ?? parsed.title,
              customerName:
                form.customerNameInput?.value ?? parsed.customerName,
              customerEmail:
                form.customerEmailInput?.value ?? parsed.customerEmail,
              orderRef: form.orderRefInput?.value ?? parsed.orderRef,
            });
            const result = createCaseOutputSchema.parse(
              await trpcClient.v1.support.createCase.mutate(live, { signal }),
            );
            routerRef.current.push(`/cases/${result.case.id}`);
            await detailSlot.waitUntil(
              (surface) => surface.id === result.case.id,
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
