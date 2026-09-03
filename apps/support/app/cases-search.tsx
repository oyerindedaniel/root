"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTRPCClient } from "@repo/api-client";
import {
  searchCasesInputSchema,
  searchCasesOutputSchema,
  type SupportCase,
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

export function CasesSearch() {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { present, registerSearch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [boundAsk, setBoundAsk] = useState<string | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (nextQuery: string, signal?: AbortSignal, keepField = false) => {
      const parsed = searchCasesInputSchema.parse({ query: nextQuery });
      if (!keepField) {
        setQuery(parsed.query);
      }
      setStatus("pending");
      setError(null);
      present.clear();
      try {
        const result = searchCasesOutputSchema.parse(
          await trpcClient.v1.support.searchCases.query(parsed, { signal }),
        );
        signal?.throwIfAborted();
        setCases(result.cases);
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
        setError("Case search failed.");
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
      getCases: () => cases,
      setBoundAsk,
      showEmptyBound: () => {
        setCases([]);
        setStatus("success");
      },
      runSearch,
    });
  }, [cases, registerSearch, runSearch]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">Cases</h1>
          <p className="text-base text-muted-foreground">
            Search cases.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/cases/new")}>
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
      {status === "success" && cases.length === 0 ? (
        <p className="text-base text-muted-foreground">No matching cases.</p>
      ) : null}
      {present.choosing || boundAsk ? (
        <PresentAsk>{boundAsk ?? "Pick a case"}</PresentAsk>
      ) : null}
      <ul className="flex flex-col gap-3">
        {cases.map((supportCase) => (
          <SearchHit
            key={supportCase.id}
            revealed={present.choosing && present.hitId === supportCase.id}
            onSelect={
              present.choosing
                ? () => present.choose(supportCase.id)
                : () => router.push(`/cases/${supportCase.id}`)
            }
          >
            <p className="text-base font-medium">{supportCase.title}</p>
            <p className="mt-1 text-base text-muted-foreground">
              {supportCase.customerName}
            </p>
            <p className="mt-1 font-mono text-base text-muted-foreground">
              {supportCase.customerEmail}
            </p>
            <p className="mt-2 font-mono text-base">{supportCase.orderRef}</p>
            <p className="mt-2 text-base capitalize">{supportCase.status}</p>
          </SearchHit>
        ))}
      </ul>
    </main>
  );
}
