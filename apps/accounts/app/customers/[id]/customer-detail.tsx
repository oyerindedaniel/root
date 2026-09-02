"use client";

import { useTRPCClient } from "@repo/api-client";
import {
  openCustomerOutputSchema,
  type Customer,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { useWorkspace } from "../../workspace-shell";

type LoadStatus = "pending" | "success" | "error";

export function CustomerDetail({ id }: { id: string }) {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { registerDetail } = useWorkspace();
  const [status, setStatus] = useState<LoadStatus>("pending");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    return registerDetail({ id });
  }, [id, registerDetail]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus("pending");
    setError(null);
    void (async () => {
      try {
        const result = openCustomerOutputSchema.parse(
          await trpcClient.v1.accounts.getCustomer.query(
            { id },
            { signal: controller.signal },
          ),
        );
        setCustomer(result.customer);
        setStatus("success");
      } catch (caught) {
        if (
          controller.signal.aborted ||
          (caught instanceof DOMException && caught.name === "AbortError")
        ) {
          return;
        }
        setStatus("error");
        setError("Customer not found.");
      }
    })();
    return () => controller.abort();
  }, [id, trpcClient]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">
            {customer?.name ?? "Customer"}
          </h1>
          <p className="text-base text-muted-foreground">
            Customer record.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Customers
        </Button>
      </header>
      <div className="flex items-center gap-2">
        <p className="text-base">Status</p>
        <Badge
          variant={
            status === "success"
              ? "success"
              : status === "error"
                ? "destructive"
                : "warning"
          }
        >
          {status}
        </Badge>
      </div>
      {error ? <p className="text-base text-destructive">{error}</p> : null}
      {customer ? (
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium">{customer.name}</p>
          <p className="font-mono text-base text-muted-foreground">
            {customer.email}
          </p>
        </div>
      ) : null}
    </main>
  );
}
