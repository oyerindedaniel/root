"use client";

import { useTRPCClient } from "@repo/api-client";
import {
  openProductOutputSchema,
  type ShopProduct,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { useWorkspace } from "../../workspace-shell";

type LoadStatus = "pending" | "success" | "error";

export function ProductDetail({ id }: { id: string }) {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { registerDetail } = useWorkspace();
  const [status, setStatus] = useState<LoadStatus>("pending");
  const [product, setProduct] = useState<ShopProduct | null>(null);
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
        const result = openProductOutputSchema.parse(
          await trpcClient.v1.shop.getProduct.query(
            { id },
            { signal: controller.signal },
          ),
        );
        setProduct(result.product);
        setStatus("success");
      } catch (caught) {
        if (
          controller.signal.aborted ||
          (caught instanceof DOMException && caught.name === "AbortError")
        ) {
          return;
        }
        setStatus("error");
        setError("Product not found.");
      }
    })();
    return () => controller.abort();
  }, [id, trpcClient]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">
            {product?.name ?? "Product"}
          </h1>
          <p className="text-base text-muted-foreground">Product record.</p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Catalog
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
      {product ? (
        <div className="flex flex-col gap-2">
          <p className="text-base font-medium">{product.name}</p>
          <p className="text-base text-muted-foreground">
            {product.description}
          </p>
          <p className="font-mono text-base">${product.priceUsd}</p>
        </div>
      ) : null}
    </main>
  );
}
