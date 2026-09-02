"use client";

import { useTRPCClient } from "@repo/api-client";
import {
  createCustomerInputSchema,
  createCustomerOutputSchema,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useWorkspace } from "../../workspace-shell";

type FormStatus = "idle" | "pending" | "success" | "error";

export function CustomerCreate() {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { present, registerCreate } = useWorkspace();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const runCreate = useCallback(async () => {
    const parsed = createCustomerInputSchema.parse({
      name: nameInputRef.current?.value ?? name,
      email: emailInputRef.current?.value ?? email,
    });
    setName(parsed.name);
    setEmail(parsed.email);
    setStatus("pending");
    setError(null);
    try {
      const result = createCustomerOutputSchema.parse(
        await trpcClient.v1.accounts.createCustomer.mutate(parsed),
      );
      setStatus("success");
      router.push(`/customers/${result.customer.id}`);
      return result;
    } catch {
      setStatus("error");
      setError("Customer create failed.");
      throw new Error("Customer create failed.");
    }
  }, [email, name, router, trpcClient]);

  useLayoutEffect(() => {
    return registerCreate({
      get nameInput() {
        return nameInputRef.current;
      },
      get emailInput() {
        return emailInputRef.current;
      },
      setName,
      setEmail,
    });
  }, [registerCreate]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">New customer</h1>
          <p className="text-base text-muted-foreground">
            Create a customer.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Customers
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
          Name
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            name="name"
          />
        </Label>
        <Label>
          Email
          <Input
            ref={emailInputRef}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            name="email"
          />
        </Label>
        <Button type="submit" intent={present.intent}>
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
