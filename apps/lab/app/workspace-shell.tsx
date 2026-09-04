"use client";

import { requirePublicEnv } from "@repo/api-client/env";
import {
  createDocumentToolGrantGate,
  createDocumentVisibilityGate,
  parseToolExecuteInput,
} from "@repo/contracts";
import { useToolPresent } from "@repo/ui/tool-present";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

const rootOrigin = requirePublicEnv(
  "NEXT_PUBLIC_ROOT_ORIGIN",
  process.env.NEXT_PUBLIC_ROOT_ORIGIN,
);

const PING_INPUT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false,
} as const;

const SET_STATUS_INPUT_SCHEMA = {
  type: "object",
  properties: {
    status: {
      type: "string",
      description: "Status text shown on the Lab bench.",
    },
  },
  required: ["status"],
  additionalProperties: false,
} as const;

type BenchSurface = {
  statusInput: HTMLInputElement | null;
  setStatus: (value: string) => void;
  getStatus: () => string;
  flash: () => void;
};

type WorkspaceValue = {
  present: ReturnType<typeof useToolPresent>;
  status: string;
  setStatus: (value: string) => void;
  flashed: boolean;
  flash: () => void;
  registerBench: (surface: BenchSurface) => () => void;
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
  const visibilityGateRef = useRef(createDocumentVisibilityGate());
  const present = useToolPresent({
    rootOrigin,
    gate: visibilityGateRef.current,
  });
  const [status, setStatusState] = useState("ready");
  const [flashed, setFlashed] = useState(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const benchSlot = useRef(makeSlot<BenchSurface>()).current;
  const grantGate = useRef(createDocumentToolGrantGate(rootOrigin)).current;

  useEffect(() => grantGate.listen(), [grantGate]);

  const setStatus = useCallback((value: string) => {
    setStatusState(value);
    statusRef.current = value;
  }, []);

  const flash = useCallback(() => {
    setFlashed(true);
    if (flashTimerRef.current) {
      clearTimeout(flashTimerRef.current);
    }
    flashTimerRef.current = setTimeout(() => {
      setFlashed(false);
      flashTimerRef.current = null;
    }, 1200);
  }, []);

  const registerBench = useCallback(
    (surface: BenchSurface) => benchSlot.register(surface),
    [benchSlot],
  );

  const value = useMemo(
    () => ({
      present,
      status,
      setStatus,
      flashed,
      flash,
      registerBench,
    }),
    [present, status, setStatus, flashed, flash, registerBench],
  );

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void modelContext.registerTool(
      {
        name: "ping",
        title: "Ping Lab",
        description: "Confirms Lab is reachable and returns the live status.",
        inputSchema: PING_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: grantGate.guard("ping", async (_input, options) => {
          const signal = options?.signal ?? controller.signal;
          const bench = await benchSlot.waitUntil(() => true, signal);
          present.arm();
          try {
            bench.flash();
            present.commit("status");
            return {
              status: "success",
              ok: true,
              liveStatus: bench.getStatus(),
            };
          } catch (caught) {
            present.commit(null);
            throw caught;
          }
        }),
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    void modelContext.registerTool(
      {
        name: "set_status",
        title: "Set Lab status",
        description:
          "Fills the Lab status field. A human must click Apply on stage; this tool does not write the status itself until then.",
        inputSchema: SET_STATUS_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: false,
          untrustedContentHint: false,
        },
        execute: grantGate.guard("set_status", async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const raw = parseToolExecuteInput(input);
          if (
            !raw ||
            typeof raw !== "object" ||
            typeof Reflect.get(raw, "status") !== "string"
          ) {
            throw new Error("set_status requires a status string.");
          }
          const nextStatus = String(Reflect.get(raw, "status")).slice(0, 120);
          if (!nextStatus) {
            throw new Error("set_status requires a non-empty status.");
          }
          if (!visibilityGateRef.current.shouldPresent()) {
            throw new Error("set_status requires the Lab window on stage.");
          }
          const bench = await benchSlot.waitUntil(() => true, signal);
          present.arm();
          present.setCoedit(true);
          try {
            const filled = await present.fill({
              text: nextStatus,
              setValue: bench.setStatus,
              input: bench.statusInput,
              signal,
            });
            await present.waitForPersist({ signal });
            signal.throwIfAborted();
            if (!visibilityGateRef.current.shouldPresent()) {
              throw new Error("set_status requires the Lab window on stage.");
            }
            present.setCoedit(false);
            const submitted =
              bench.statusInput?.value ?? filled?.text ?? nextStatus;
            const trimmed = submitted.trim().slice(0, 120);
            if (!trimmed) {
              throw new Error("set_status requires a non-empty status.");
            }
            bench.setStatus(trimmed);
            bench.flash();
            present.commit("status");
            return {
              status: "success",
              liveStatus: trimmed,
            };
          } catch (caught) {
            present.commit(null);
            throw caught;
          } finally {
            present.setCoedit(false);
          }
        }),
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    return () => controller.abort();
  }, [
    benchSlot,
    present.arm,
    present.commit,
    present.fill,
    present.setCoedit,
    present.waitForPersist,
    grantGate,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
