"use client";

import { useTRPC } from "@repo/api-client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function SessionWatcher({ onSignedOut }: { onSignedOut: () => void }) {
  const trpc = useTRPC();
  const me = useQuery({
    ...trpc.v1.auth.me.queryOptions(),
    retry: false,
  });

  useEffect(() => {
    if (me.error) {
      onSignedOut();
    }
  }, [me.error, onSignedOut]);

  return null;
}
