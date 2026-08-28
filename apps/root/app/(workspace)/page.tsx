import { requireRootOperator } from "@/lib/auth/require-root-operator";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { loadProviderDirectory } from "@/lib/providers/directory";

export default async function WorkspacePage() {
  const operator = await requireRootOperator();
  const directory = loadProviderDirectory({
    NEXT_PUBLIC_ROOT_ORIGIN: process.env.NEXT_PUBLIC_ROOT_ORIGIN,
    NEXT_PUBLIC_SHOP_ORIGIN: process.env.NEXT_PUBLIC_SHOP_ORIGIN,
    NEXT_PUBLIC_SHOP_ENTRY_URL: process.env.NEXT_PUBLIC_SHOP_ENTRY_URL,
  });

  return <WorkspaceShell operator={operator} directory={directory} />;
}
