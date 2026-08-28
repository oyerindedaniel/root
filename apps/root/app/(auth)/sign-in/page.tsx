import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { parseReturnPath } from "@/lib/auth/return-url";
import { loadRootOperator } from "@/lib/auth/require-root-operator";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const nextPath = parseReturnPath(params.from);
  const operator = await loadRootOperator();
  if (operator) {
    redirect(nextPath);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Sign in</h1>
      </header>
      <SignInForm nextPath={nextPath} />
    </main>
  );
}
