"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTRPCClient } from "@repo/api-client";
import {
  searchProductsInputSchema,
  searchProductsOutputSchema,
  type ShopProduct,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { PresentAsk } from "@repo/ui/present-ask";
import { SearchHit } from "@repo/ui/search-hit";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useWorkspace } from "./workspace-shell";

type SearchStatus = "idle" | "pending" | "success" | "error";

export function CatalogSearch() {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { present, registerSearch } = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(
    async (nextQuery: string, signal?: AbortSignal) => {
      const parsed = searchProductsInputSchema.parse({ query: nextQuery });
      setQuery(parsed.query);
      setStatus("pending");
      setError(null);
      present.clear();
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
          <h1 className="text-3xl font-medium">Catalog</h1>
          <p className="text-base text-muted-foreground">
            Search the catalog.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/products/new")}>
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
      {status === "success" && products.length === 0 ? (
        <p className="text-base text-muted-foreground">No matching products.</p>
      ) : null}
      {present.choosing ? <PresentAsk>Pick a product.</PresentAsk> : null}
      <ul className="flex flex-col gap-3">
        {products.map((product, index) => (
          <SearchHit
            key={product.id}
            ref={index === 0 ? present.firstHitRef : undefined}
            revealed={present.hitId === product.id}
            onSelect={
              present.choosing
                ? () => present.choose(product.id)
                : () => router.push(`/products/${product.id}`)
            }
          >
            <p className="text-base font-medium">{product.name}</p>
            <p className="mt-1 text-base text-muted-foreground">
              {product.description}
            </p>
            <p className="mt-2 font-mono text-base">${product.priceUsd}</p>
          </SearchHit>
        ))}
      </ul>
    </main>
  );
}
