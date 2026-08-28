"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useTRPCClient } from "@repo/api-client";
import {
  APP_ORIGINS,
  SEARCH_PRODUCTS_INPUT_SCHEMA,
  parseToolExecuteInput,
  searchProductsInputSchema,
  searchProductsOutputSchema,
  type ShopProduct,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useCallback, useEffect, useState } from "react";

import { getDocumentModelContext } from "@/lib/model-context";

type SearchStatus = "idle" | "pending" | "success" | "error";

export function CatalogSearch() {
  const trpcClient = useTRPCClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(
    async (nextQuery: string, signal?: AbortSignal) => {
      const parsed = searchProductsInputSchema.parse({ query: nextQuery });
      setQuery(parsed.query);
      setStatus("pending");
      setError(null);
      try {
        const result = searchProductsOutputSchema.parse(
          await trpcClient.v1.shop.searchProducts.query(parsed, { signal }),
        );
        signal?.throwIfAborted();
        setProducts(result.products);
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
        setError("Catalog search failed.");
        throw caught;
      }
    },
    [trpcClient],
  );

  useEffect(() => {
    const modelContext = getDocumentModelContext(document);
    const rootOrigin =
      process.env.NEXT_PUBLIC_ROOT_ORIGIN?.trim() || APP_ORIGINS.root;
    if (!modelContext) {
      return;
    }
    const controller = new AbortController();
    void modelContext.registerTool(
      {
        name: "search_products",
        title: "Search products",
        description:
          "Searches the test catalog and visibly displays matching products.",
        inputSchema: SEARCH_PRODUCTS_INPUT_SCHEMA,
        annotations: {
          readOnlyHint: true,
          untrustedContentHint: false,
        },
        execute: async (input, options) => {
          const parsed = searchProductsInputSchema.parse(
            parseToolExecuteInput(input),
          );
          return runSearch(parsed.query, options.signal);
        },
      },
      {
        exposedTo: [rootOrigin],
        signal: controller.signal,
      },
    );
    return () => controller.abort();
  }, [runSearch]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Catalog</h1>
        <p className="text-base text-muted-foreground">
          Search the test catalog. This page works without WebMCP.
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
      {status === "success" && products.length === 0 ? (
        <p className="text-base text-muted-foreground">No matching products.</p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {products.map((product) => (
          <li
            key={product.id}
            className="rounded-lg border border-border p-4"
          >
            <p className="text-base font-medium">{product.name}</p>
            <p className="mt-1 text-base text-muted-foreground">
              {product.description}
            </p>
            <p className="mt-2 font-mono text-base">${product.priceUsd}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
