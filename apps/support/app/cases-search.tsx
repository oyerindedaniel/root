"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTRPCClient } from "@repo/api-client";
import { requirePublicEnv } from "@repo/api-client/env";
import {
  SEARCH_CASES_INPUT_SCHEMA,
  createDocumentVisibilityGate,
  parseToolExecuteInput,
  searchCasesInputSchema,
  searchCasesOutputSchema,
  type SupportCase,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { SearchHit } from "@repo/ui/search-hit";
import { useToolPresent } from "@repo/ui/tool-present";
import { useCallback, useEffect, useRef, useState } from "react";

type SearchStatus = "idle" | "pending" | "success" | "error";

const rootOrigin = requirePublicEnv(
  "NEXT_PUBLIC_ROOT_ORIGIN",
  process.env.NEXT_PUBLIC_ROOT_ORIGIN,
);

export function CasesSearch() {
  const trpcClient = useTRPCClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const visibilityGateRef = useRef(createDocumentVisibilityGate());
  const present = useToolPresent({
    rootOrigin,
    gate: visibilityGateRef.current,
  });

  const runSearch = useCallback(
    async (nextQuery: string, signal?: AbortSignal) => {
      const parsed = searchCasesInputSchema.parse({ query: nextQuery });
      setQuery(parsed.query);
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

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void modelContext.registerTool(
      {
        name: "search_cases",
        title: "Search cases",
        description:
          "Searches support projections and visibly displays matching cases.",
        inputSchema: SEARCH_CASES_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const parsed = searchCasesInputSchema.parse(
            parseToolExecuteInput(input),
          );
          present.arm();
          try {
            await present.fill({
              text: parsed.query,
              setValue: setQuery,
              input: queryInputRef.current,
              signal: options.signal,
            });
            options.signal?.throwIfAborted();
            const result = await runSearch(parsed.query, options.signal);
            present.commit(result.cases[0]?.id ?? null);
            return result;
          } catch (caught) {
            present.commit(null);
            throw caught;
          }
        },
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    return () => controller.abort();
  }, [present.arm, present.commit, present.fill, runSearch]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Cases</h1>
        <p className="text-base text-muted-foreground">
          Search cases. This page works without WebMCP.
        </p>
      </header>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
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
        <Button type="submit">
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
      <ul className="flex flex-col gap-3">
        {cases.map((supportCase, index) => (
          <SearchHit
            key={supportCase.id}
            ref={index === 0 ? present.firstHitRef : undefined}
            revealed={present.hitId === supportCase.id}
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
