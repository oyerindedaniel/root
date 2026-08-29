import type { PropsWithChildren } from "react";

import { requireAccount } from "@/lib/auth/account";

export default async function WorkspaceTemplate({
  children,
}: PropsWithChildren) {
  await requireAccount();
  return children;
}
