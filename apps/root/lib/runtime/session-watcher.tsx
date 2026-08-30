"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { TRPCClientError, useTRPC } from "@repo/api-client";
import type { Account } from "@repo/contracts";

export function SessionWatcher({
  account,
  onSessionEnded,
}: {
  account: Account;
  onSessionEnded: () => void;
}) {
  const trpc = useTRPC();
  const me = useQuery({
    ...trpc.v1.auth.me.queryOptions(),
    initialData: account,
    refetchOnMount: false,
    refetchOnWindowFocus: "always",
    retry: false,
  });
  const announced = useRef(false);

  useEffect(() => {
    if (
      announced.current ||
      !(me.error instanceof TRPCClientError) ||
      me.error.data?.code !== "UNAUTHORIZED"
    ) {
      return;
    }
    announced.current = true;
    onSessionEnded();
  }, [me.error, onSessionEnded]);

  return null;
}
