"use client";

import { CheckIcon } from "@heroicons/react/24/outline";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { PresentHalo } from "@repo/ui/present-halo";
import { useLayoutEffect, useRef } from "react";

import { useWorkspace } from "@/app/workspace-shell";

export function LabBench() {
  const { present, status, setStatus, flashed, flash, registerBench } =
    useWorkspace();
  const statusInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    return registerBench({
      get statusInput() {
        return statusInputRef.current;
      },
      setStatus,
      getStatus: () => statusInputRef.current?.value ?? status,
      flash,
    });
  }, [flash, registerBench, setStatus, status]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Lab</h1>
        <p className="text-base text-muted-foreground">
          Custom provider bench for Root Test and granted invoke.
        </p>
      </header>
      <ul className="list-none p-0">
        <li
          ref={present.firstHitRef}
          className="relative w-fit rounded-lg p-1"
        >
          <PresentHalo
            active={flashed || present.hitId === "status"}
            rounded="lg"
          />
          <div className="relative flex items-center gap-2">
            <p className="text-base">Live status</p>
            <Badge
              variant={
                flashed || present.hitId === "status" ? "success" : "muted"
              }
            >
              {status}
            </Badge>
          </div>
        </li>
      </ul>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (present.persist()) {
            return;
          }
          const next = statusInputRef.current?.value.trim() ?? "";
          if (!next) {
            return;
          }
          setStatus(next);
        }}
      >
        <Label>
          Status
          <Input
            ref={statusInputRef}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            name="status"
            maxLength={120}
          />
        </Label>
        <Button type="submit" intent={present.intent}>
          <CheckIcon className="size-4" />
          Apply
        </Button>
      </form>
    </main>
  );
}
