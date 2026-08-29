"use client";

import { Button } from "@repo/ui/button";
import { useRouter } from "next/navigation";

import { useRuntime } from "@/lib/runtime/runtime-context";

export function SignedOutState() {
  const router = useRouter();
  const { state } = useRuntime();
  if (state.sessionStatus !== "signed-out") {
    return null;
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/90 p-6">
      <div className="max-w-md rounded-lg border border-border bg-background p-6">
        <h2 className="text-3xl font-medium">Session ended</h2>
        <p className="mt-3 text-base text-muted-foreground">
          Your session ended. Sign in again to continue.
        </p>
        <Button
          className="mt-4"
          onClick={() => {
            router.replace("/sign-in");
            router.refresh();
          }}
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}
