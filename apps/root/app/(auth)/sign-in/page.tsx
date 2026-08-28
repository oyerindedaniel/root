import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { getAccount } from "@/lib/auth/account";

export default async function SignInPage() {
  const account = await getAccount();
  if (account) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-medium">Sign in</h1>
      </header>
      <SignInForm />
    </main>
  );
}
