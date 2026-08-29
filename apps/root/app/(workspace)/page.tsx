import { requireAccount } from "@/lib/auth/account";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { loadProviderDirectory } from "@/lib/providers/directory";

export default async function WorkspacePage() {
  const account = await requireAccount();
  const directory = loadProviderDirectory({
    NEXT_PUBLIC_ROOT_ORIGIN: process.env.NEXT_PUBLIC_ROOT_ORIGIN,
    NEXT_PUBLIC_SHOP_ORIGIN: process.env.NEXT_PUBLIC_SHOP_ORIGIN,
    NEXT_PUBLIC_SHOP_ENTRY_URL: process.env.NEXT_PUBLIC_SHOP_ENTRY_URL,
    NEXT_PUBLIC_ACCOUNTS_ORIGIN: process.env.NEXT_PUBLIC_ACCOUNTS_ORIGIN,
    NEXT_PUBLIC_ACCOUNTS_ENTRY_URL: process.env.NEXT_PUBLIC_ACCOUNTS_ENTRY_URL,
  });

  return <WorkspaceShell account={account} directory={directory} />;
}
