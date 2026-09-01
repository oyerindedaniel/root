"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTRPCClient } from "@repo/api-client";
import { requirePublicEnv } from "@repo/api-client/env";
import {
  SEARCH_CUSTOMERS_INPUT_SCHEMA,
  createDocumentVisibilityGate,
  parseToolExecuteInput,
  portableCustomerReference,
  searchCustomersInputSchema,
  searchCustomersOutputSchema,
  type Customer,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { PresentAsk } from "@repo/ui/present-ask";
import { SearchHit } from "@repo/ui/search-hit";
import { useToolPresent } from "@repo/ui/tool-present";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchStatus = "idle" | "pending" | "success" | "error";

const rootOrigin = requirePublicEnv(
  "NEXT_PUBLIC_ROOT_ORIGIN",
  process.env.NEXT_PUBLIC_ROOT_ORIGIN,
);

export function CustomerSearch() {
  const trpcClient = useTRPCClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const visibilityGateRef = useRef(createDocumentVisibilityGate());
  const present = useToolPresent({
    rootOrigin,
    gate: visibilityGateRef.current,
  });

  const runSearch = useCallback(
    async (nextQuery: string, signal?: AbortSignal) => {
      const parsed = searchCustomersInputSchema.parse({ query: nextQuery });
      setQuery(parsed.query);
      setStatus("pending");
      setError(null);
      present.clear();
      try {
        const result = searchCustomersOutputSchema.parse(
          await trpcClient.v1.accounts.searchCustomers.query(parsed, {
            signal,
          }),
        );
        signal?.throwIfAborted();
        setCustomers(result.customers);
        setStatus("success");
        return result;
      } catch (caught) {
        if (
          signal?.aborted ||
          (caught instanceof DOMException && caught.name === "AbortError")
        ) {
          throw caught;
        }
        setStatus("error");
        setError("Customer search failed.");
        throw caught;
      }
    },
    [present.clear, trpcClient],
  );

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void modelContext.registerTool(
      {
        name: "search_customers",
        title: "Search customers",
        description:
          "Searches the directory and visibly displays matching customers.",
        inputSchema: SEARCH_CUSTOMERS_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const signal = options?.signal ?? controller.signal;
          const parsed = searchCustomersInputSchema.parse(
            parseToolExecuteInput(input),
          );
          present.arm();
          present.setCoedit(true);
          try {
            const filled = await present.fill({
              text: parsed.query,
              setValue: setQuery,
              input: queryInputRef.current,
              signal,
            });
            if (filled?.yielded) {
              await present.waitForPersist({ signal });
            } else {
              await present.preview({ signal });
              const live =
                queryInputRef.current?.value ?? filled?.text ?? parsed.query;
              if (filled && live !== filled.text) {
                await present.waitForPersist({ signal });
              }
            }
            signal.throwIfAborted();
            present.setCoedit(false);
            const submitted =
              queryInputRef.current?.value ?? filled?.text ?? parsed.query;
            const result = await runSearch(submitted, signal);
            const selectedId = await present.waitForSelect({
              candidateId: result.customers[0]?.id ?? null,
              signal,
            });
            const hit = result.customers.find(
              (customer) => customer.id === selectedId,
            );
            present.commit(selectedId ?? result.customers[0]?.id ?? null);
            return {
              ...result,
              ...(selectedId ? { selectedId } : {}),
              ...(hit
                ? {
                    selected: portableCustomerReference(
                      hit,
                      new Date().toISOString(),
                    ),
                  }
                : {}),
            };
          } catch (caught) {
            present.commit(null);
            throw caught;
          } finally {
            present.setCoedit(false);
          }
        },
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    return () => controller.abort();
  }, [
    present.arm,
    present.commit,
    present.fill,
    present.preview,
    present.setCoedit,
    present.waitForPersist,
    present.waitForSelect,
    runSearch,
  ]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Customers</h1>
        <p className="text-base text-muted-foreground">
          Search customers. This page works without WebMCP.
        </p>
      </header>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (present.persist()) {
            return;
          }
          void runSearch(query).catch(() => undefined);
        }}
      >
        <Label>
          Query
          <Input
            ref={queryInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            name="query"
          />
        </Label>
        <Button type="submit" intent={present.intent}>
          <MagnifyingGlassIcon className="size-4" />
          Search
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
      {status === "success" && customers.length === 0 ? (
        <p className="text-base text-muted-foreground">No matching customers.</p>
      ) : null}
      {present.choosing ? <PresentAsk>Pick a customer.</PresentAsk> : null}
      <ul className="flex flex-col gap-3">
        {customers.map((customer, index) => (
          <SearchHit
            key={customer.id}
            ref={index === 0 ? present.firstHitRef : undefined}
            revealed={present.hitId === customer.id}
            onSelect={
              present.choosing ? () => present.choose(customer.id) : undefined
            }
          >
            <p className="text-base font-medium">{customer.name}</p>
            <p className="mt-1 font-mono text-base text-muted-foreground">
              {customer.email}
            </p>
          </SearchHit>
        ))}
      </ul>
    </main>
  );
}
