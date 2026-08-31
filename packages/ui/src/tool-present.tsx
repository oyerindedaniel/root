import { useCallback, useEffect, useRef, useState } from "react";

import { fillPresentedInput } from "./lib/fill-input";

export type ToolPresentGate = {
  applyMessage: (
    data: unknown,
    origin: string,
    expectedOrigin: string,
  ) => boolean;
  shouldPresent: () => boolean;
};

export function useToolPresent(options: {
  rootOrigin: string;
  gate: ToolPresentGate;
}) {
  const { rootOrigin, gate } = options;
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const armedRef = useRef(false);
  const firstHitRef = useRef<HTMLLIElement | null>(null);
  const [hitId, setHitId] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      gateRef.current.applyMessage(event.data, event.origin, rootOrigin);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [rootOrigin]);

  useEffect(() => {
    if (!hitId) {
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
  }, [hitId]);

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

  const fill = useCallback(
    async (options: {
      text: string;
      setValue: (value: string) => void;
      input: HTMLInputElement | null;
      signal?: AbortSignal;
    }) => {
      if (!armedRef.current || !gateRef.current.shouldPresent()) {
        return;
      }
      const instant = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      await fillPresentedInput({
        text: options.text,
        setValue: options.setValue,
        input: options.input,
        signal: options.signal,
        instant,
      });
    },
    [],
  );

  return { arm, commit, clear, fill, hitId, firstHitRef };
}
