import type { ReactNode } from "react";

import { requireAccount } from "@/lib/auth/account";

export default async function WorkspaceTemplate({
  children,
}: {
  children: ReactNode;
}) {
  await requireAccount();
  return children;
}
