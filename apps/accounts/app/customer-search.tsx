"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTRPCClient } from "@repo/api-client";
import {
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
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useWorkspace } from "@/app/workspace-shell";

type SearchStatus = "idle" | "pending" | "success" | "error";

export function CustomerSearch() {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { present, registerSearch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

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

  useLayoutEffect(() => {
    return registerSearch({
      get queryInput() {
        return queryInputRef.current;
      },
      setQuery,
      runSearch,
    });
  }, [registerSearch, runSearch]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">Customers</h1>
          <p className="text-base text-muted-foreground">
            Search customers.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => router.push("/customers/new")}
        >
          <PlusIcon className="size-4" />
          New
        </Button>
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
      {present.choosing ? <PresentAsk>Pick a customer</PresentAsk> : null}
      <ul className="flex flex-col gap-3">
        {customers.map((customer, index) => (
          <SearchHit
            key={customer.id}
            ref={index === 0 ? present.firstHitRef : undefined}
            revealed={present.hitId === customer.id}
            onSelect={
              present.choosing
                ? () => present.choose(customer.id)
                : () => router.push(`/customers/${customer.id}`)
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
