import type { ReactNode } from "react";

import { requireRootOperator } from "@/lib/auth/require-root-operator";

export default async function WorkspaceTemplate({
  children,
}: {
  children: ReactNode;
}) {
  await requireRootOperator();
  return children;
}
