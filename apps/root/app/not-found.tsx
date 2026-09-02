"use client";

import { Button } from "@repo/ui/button";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="relative min-h-dvh">
      <div
        role="status"
        aria-labelledby="not-found-title"
        className="absolute inset-0 flex items-center justify-center bg-background/90 p-6"
      >
        <div className="max-w-md rounded-lg border border-border bg-background p-6">
          <img
            src="/icons/root-icon.webp"
            alt=""
            width={64}
            height={64}
            className="size-16"
          />
          <h1 id="not-found-title" className="mt-3 text-3xl font-medium">
            Not found
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            This page is not on Root.
          </p>
          <Button
            className="mt-4"
            onClick={() => {
              router.replace("/");
              router.refresh();
            }}
          >
            Workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
