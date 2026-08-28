import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { makeServerTrpcClient } from "@repo/api-client/server";
import type { OperatorIdentity } from "@repo/contracts";

import { operatorFromSessionUser, workspaceEntry } from "./operator";

export const loadRootOperator = cache(async (): Promise<OperatorIdentity | null> => {
  const cookieStore = await cookies();
  const client = makeServerTrpcClient(cookieStore.toString());
  try {
    const user = await client.v1.auth.me.query();
    return operatorFromSessionUser(user);
  } catch {
    return null;
  }
});

export const requireRootOperator = cache(async (): Promise<OperatorIdentity> => {
  const operator = await loadRootOperator();
  const entry = workspaceEntry(operator);
  if (entry.kind === "redirect") {
    redirect(entry.href);
  }
  return entry.operator;
});
