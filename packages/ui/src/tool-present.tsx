import { useCallback, useEffect, useRef, useState } from "react";

import { coeditMessage, pendingHumanMessage } from "@repo/contracts";

import {
  fillPresentedInput,
  TOOL_PRESENT_PREVIEW_MS,
  waitPresent,
  waitForChoice,
  type FillPresentResult,
} from "./lib/fill-input";

export type ToolPresentGate = {
  applyMessage: (
    data: unknown,
    origin: string,
    expectedOrigin: string,
  ) => boolean;
  shouldPresent: () => boolean;
};

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof DOMException) {
    return signal.reason;
  }
  return new DOMException("Aborted", "AbortError");
}

export function useToolPresent(options: {
  rootOrigin: string;
  gate: ToolPresentGate;
}) {
  const { rootOrigin, gate } = options;
  const gateRef = useRef(gate);
  const armedRef = useRef(false);
  const coeditPostedRef = useRef(false);
  const persistWaiterRef = useRef<{
    resolve: () => void;
    dispose: () => void;
  } | null>(null);
  const chooseRef = useRef<(id: string) => void>(undefined);
  const pendingPostedRef = useRef(false);
  const firstHitRef = useRef<HTMLLIElement | null>(null);
  const [hitId, setHitId] = useState<string | null>(null);
  const [intent, setIntent] = useState(false);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      gateRef.current.applyMessage(event.data, event.origin, rootOrigin);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [rootOrigin]);

  useEffect(() => {
    if (!hitId || choosing) {
      return;
    }
    firstHitRef.current?.scrollIntoView({
      behavior: "instant",
      block: "nearest",
    });
    const timeout = window.setTimeout(() => {
      setHitId(null);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [hitId, choosing]);

  const arm = useCallback(() => {
    armedRef.current = gateRef.current.shouldPresent();
  }, []);

  const commit = useCallback((firstId: string | null) => {
    if (!armedRef.current) {
      return;
    }
    armedRef.current = false;
    if (!firstId) {
      return;
    }
    setHitId(firstId);
  }, []);

  const clear = useCallback(() => {
    setHitId(null);
  }, []);

  const setCoedit = useCallback(
    (open: boolean) => {
      if (window.parent === window) {
        return;
      }
      if (open && !armedRef.current) {
        return;
      }
      if (!open && !coeditPostedRef.current) {
        return;
      }
      window.parent.postMessage(coeditMessage(open), rootOrigin);
      coeditPostedRef.current = open;
    },
    [rootOrigin],
  );

  const setPending = useCallback(
    (open: boolean) => {
      if (window.parent === window) {
        return;
      }
      if (open && !armedRef.current) {
        return;
      }
      if (!open && !pendingPostedRef.current) {
        return;
      }
      window.parent.postMessage(pendingHumanMessage(open), rootOrigin);
      pendingPostedRef.current = open;
    },
    [rootOrigin],
  );

  const persist = useCallback(() => {
    const waiter = persistWaiterRef.current;
    if (waiter) {
      waiter.dispose();
      persistWaiterRef.current = null;
      waiter.resolve();
      return true;
    }
    return armedRef.current;
  }, []);

  const waitForPersist = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!armedRef.current || !gateRef.current.shouldPresent()) {
      return;
    }
    setIntent(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const signal = options?.signal;
        if (signal?.aborted) {
          reject(abortError(signal));
          return;
        }
        const dispose = () => {
          signal?.removeEventListener("abort", onAbort);
        };
        const onAbort = () => {
          persistWaiterRef.current = null;
          dispose();
          reject(abortError(signal));
        };
        persistWaiterRef.current = {
          resolve: () => {
            dispose();
            resolve();
          },
          dispose,
        };
        signal?.addEventListener("abort", onAbort, { once: true });
      });
    } finally {
      persistWaiterRef.current = null;
      setIntent(false);
    }
  }, []);

  const choose = useCallback((id: string) => {
    chooseRef.current?.(id);
  }, []);

  const waitForSelect = useCallback(
    async (options: { candidateId: string | null; signal?: AbortSignal }) => {
      if (
        !options.candidateId ||
        !armedRef.current ||
        !gateRef.current.shouldPresent()
      ) {
        return;
      }
      setChoosing(true);
      setHitId(options.candidateId);
      setCoedit(true);
      setPending(true);
      try {
        requestAnimationFrame(() => {
          firstHitRef.current?.scrollIntoView({
            behavior: "instant",
            block: "nearest",
          });
        });
        return await waitForChoice({
          signal: options.signal,
          bind: (chooseId) => {
            chooseRef.current = (id) => {
              setHitId(id);
              chooseId(id);
            };
            return () => {
              chooseRef.current = undefined;
            };
          },
        });
      } finally {
        setChoosing(false);
        setCoedit(false);
        setPending(false);
      }
    },
    [setCoedit, setPending],
  );

  const fill = useCallback(
    async (options: {
      text: string;
      setValue: (value: string) => void;
      input: HTMLInputElement | null;
      signal?: AbortSignal;
    }): Promise<FillPresentResult | undefined> => {
      if (!armedRef.current || !gateRef.current.shouldPresent()) {
        return;
      }
      const instant = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      return fillPresentedInput({
        text: options.text,
        setValue: options.setValue,
        input: options.input,
        signal: options.signal,
        instant,
      });
    },
    [],
  );

  const preview = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!armedRef.current || !gateRef.current.shouldPresent()) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    setIntent(true);
    try {
      await waitPresent(TOOL_PRESENT_PREVIEW_MS, options?.signal);
    } finally {
      setIntent(false);
    }
  }, []);

  return {
    arm,
    commit,
    clear,
    fill,
    preview,
    setCoedit,
    persist,
    waitForPersist,
    waitForSelect,
    choose,
    choosing,
    intent,
    hitId,
    firstHitRef,
  };
}
