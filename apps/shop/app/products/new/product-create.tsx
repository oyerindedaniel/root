"use client";

import { useTRPCClient } from "@repo/api-client";
import {
  createProductInputSchema,
  createProductOutputSchema,
} from "@repo/contracts";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { useWorkspace } from "@/app/workspace-shell";

type FormStatus = "idle" | "pending" | "success" | "error";

export function ProductCreate() {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const { present, registerCreate } = useWorkspace();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const runCreate = useCallback(async () => {
    const parsed = createProductInputSchema.parse({
      name: nameInputRef.current?.value ?? name,
      description: descriptionInputRef.current?.value ?? description,
      priceUsd: Number.parseInt(
        priceInputRef.current?.value ?? priceUsd,
        10,
      ),
    });
    setName(parsed.name);
    setDescription(parsed.description);
    setPriceUsd(String(parsed.priceUsd));
    setStatus("pending");
    setError(null);
    try {
      const result = createProductOutputSchema.parse(
        await trpcClient.v1.shop.createProduct.mutate(parsed),
      );
      setStatus("success");
      router.push(`/products/${result.product.id}`);
      return result;
    } catch {
      setStatus("error");
      setError("Product create failed.");
      throw new Error("Product create failed.");
    }
  }, [description, name, priceUsd, router, trpcClient]);

  useLayoutEffect(() => {
    return registerCreate({
      get nameInput() {
        return nameInputRef.current;
      },
      get descriptionInput() {
        return descriptionInputRef.current;
      },
      get priceInput() {
        return priceInputRef.current;
      },
      setName,
      setDescription,
      setPriceUsd,
    });
  }, [registerCreate]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-medium">New product</h1>
          <p className="text-base text-muted-foreground">
            Create a product.
          </p>
        </div>
        <Button variant="ghost" onClick={() => router.push("/")}>
          Catalog
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
          Description
          <Input
            ref={descriptionInputRef}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            name="description"
          />
        </Label>
        <Label>
          Price (USD)
          <Input
            ref={priceInputRef}
            value={priceUsd}
            onChange={(event) => setPriceUsd(event.target.value)}
            name="priceUsd"
            inputMode="numeric"
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
