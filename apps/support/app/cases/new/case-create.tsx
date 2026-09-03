"use client";

import { useTRPCClient } from "@repo/api-client";
import {
  createCaseInputSchema,
  createCaseOutputSchema,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useWorkspace } from "@/app/workspace-shell";

type FormStatus = "idle" | "pending" | "success" | "error";

export function CaseCreate() {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { present, registerCreate } = useWorkspace();
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const customerNameInputRef = useRef<HTMLInputElement>(null);
  const customerEmailInputRef = useRef<HTMLInputElement>(null);
  const orderRefInputRef = useRef<HTMLInputElement>(null);

  const runCreate = useCallback(async () => {
    const parsed = createCaseInputSchema.parse({
      title: titleInputRef.current?.value ?? title,
      customerName: customerNameInputRef.current?.value ?? customerName,
      customerEmail: customerEmailInputRef.current?.value ?? customerEmail,
      orderRef: orderRefInputRef.current?.value ?? orderRef,
    });
    setTitle(parsed.title);
    setCustomerName(parsed.customerName);
    setCustomerEmail(parsed.customerEmail);
    setOrderRef(parsed.orderRef);
    setStatus("pending");
    setError(null);
    try {
      const result = createCaseOutputSchema.parse(
        await trpcClient.v1.support.createCase.mutate(parsed),
      );
      setStatus("success");
      router.push(`/cases/${result.case.id}`);
      return result;
    } catch {
      setStatus("error");
      setError("Case create failed.");
      throw new Error("Case create failed.");
    }
  }, [customerEmail, customerName, orderRef, router, title, trpcClient]);

  useLayoutEffect(() => {
    return registerCreate({
      get titleInput() {
        return titleInputRef.current;
      },
      get customerNameInput() {
        return customerNameInputRef.current;
      },
      get customerEmailInput() {
        return customerEmailInputRef.current;
      },
      get orderRefInput() {
        return orderRefInputRef.current;
      },
      setTitle,
      setCustomerName,
      setCustomerEmail,
      setOrderRef,
    });
  }, [registerCreate]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">New case</h1>
          <p className="text-base text-muted-foreground">
            Create a case.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Cases
        </Button>
      </header>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (present.persist()) {
            return;
          }
          void runCreate().catch(() => undefined);
        }}
      >
        <Label>
          Title
          <Input
            ref={titleInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            name="title"
          />
        </Label>
        <Label>
          Customer name
          <Input
            ref={customerNameInputRef}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            name="customerName"
          />
        </Label>
        <Label>
          Customer email
          <Input
            ref={customerEmailInputRef}
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            name="customerEmail"
          />
        </Label>
        <Label>
          Order ref
          <Input
            ref={orderRefInputRef}
            value={orderRef}
            onChange={(event) => setOrderRef(event.target.value)}
            name="orderRef"
          />
        </Label>
        <Button type="submit" intent={present.intent} approval={present.intent}>
          Create
        </Button>
      </form>
      <div className="flex items-center gap-2">
        <p className="text-base">Status</p>
        <Badge
          variant={
            status === "success"
              ? "success"
              : status === "error"
                ? "destructive"
                : status === "pending"
                  ? "warning"
                  : "muted"
          }
        >
          {status}
        </Badge>
      </div>
      {error ? <p className="text-base text-destructive">{error}</p> : null}
    </main>
  );
}
