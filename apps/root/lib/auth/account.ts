import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { makeServerTrpcClient } from "@repo/api-client/server";
import { accountSchema, type Account } from "@repo/contracts";

export const getAccount = cache(async (): Promise<Account | null> => {
  const cookieHeader = (await cookies()).toString();
  if (!cookieHeader) return null;

  const client = makeServerTrpcClient(cookieHeader);
  try {
    return accountSchema.parse(await client.v1.auth.me.query());
  } catch {
    return null;
  }
});

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/sign-in");
  return account;
}
