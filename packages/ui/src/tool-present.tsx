import { useCallback, useEffect, useRef, useState } from "react";

import {
  coeditMessage,
  DEFAULT_PRESENT_PACE,
  pendingHumanMessage,
  parsePresentationCancelMessage,
  parsePresentPaceMessage,
  type PresentPace,
} from "@repo/contracts";

import {
  fillPaceMs,
  fillPresentedInput,
  previewHoldMs,
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

function presentationSignal(
  signal: AbortSignal | undefined,
  presentation: AbortSignal,
) {
  return signal ? AbortSignal.any([signal, presentation]) : presentation;
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
  const presentationAbortRef = useRef(new AbortController());
  const firstHitRef = useRef<HTMLLIElement | null>(null);
  const presentPaceRef = useRef<PresentPace>(DEFAULT_PRESENT_PACE);
  const [hitId, setHitId] = useState<string | null>(null);
  const [intent, setIntent] = useState(false);
  const [choosing, setChoosing] = useState(false);

  useEffect(() => {
    gateRef.current = gate;
  }, [gate]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      gateRef.current.applyMessage(event.data, event.origin, rootOrigin);
      if (
        parsePresentationCancelMessage(
          event.data,
          event.origin,
          rootOrigin,
        )
      ) {
        presentationAbortRef.current.abort(
          new DOMException("stopped_by_user", "AbortError"),
        );
        armedRef.current = false;
        setHitId(null);
        setIntent(false);
        setChoosing(false);
        if (coeditPostedRef.current) {
          window.parent.postMessage(coeditMessage(false), rootOrigin);
          coeditPostedRef.current = false;
        }
        if (pendingPostedRef.current) {
          window.parent.postMessage(pendingHumanMessage(false), rootOrigin);
          pendingPostedRef.current = false;
        }
      }
      const pace = parsePresentPaceMessage(
        event.data,
        event.origin,
        rootOrigin,
      );
      if (pace) {
        presentPaceRef.current = pace;
      }
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
    presentationAbortRef.current.abort(
      new DOMException("Superseded", "AbortError"),
    );
    presentationAbortRef.current = new AbortController();
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
    setPending(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const signal = presentationSignal(
          options?.signal,
          presentationAbortRef.current.signal,
        );
        if (signal.aborted) {
          reject(abortError(signal));
          return;
        }
        const dispose = () => {
          signal.removeEventListener("abort", onAbort);
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
        signal.addEventListener("abort", onAbort, { once: true });
      });
    } finally {
      persistWaiterRef.current = null;
      setIntent(false);
      setPending(false);
    }
  }, [setPending]);

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
          signal: presentationSignal(
            options.signal,
            presentationAbortRef.current.signal,
          ),
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
        signal: presentationSignal(
          options.signal,
          presentationAbortRef.current.signal,
        ),
        instant,
        paceMs: fillPaceMs(options.text.length, presentPaceRef.current.fill),
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
      await waitPresent(
        previewHoldMs(presentPaceRef.current.preview),
        presentationSignal(
          options?.signal,
          presentationAbortRef.current.signal,
        ),
      );
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
