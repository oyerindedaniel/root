import { redirect } from "next/navigation";

import { SignInForm } from "@/components/auth/sign-in-form";
import { SignInProviderPattern } from "@/components/auth/sign-in-provider-pattern";
import { getAccount } from "@/lib/auth/account";

export default async function SignInPage() {
  const account = await getAccount();
  if (account) {
    redirect("/");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <SignInProviderPattern />
      <main className="mx-auto flex min-h-0 w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
        <header className="flex flex-col items-center gap-3">
          <img
            src="/icons/root-icon.webp"
            alt=""
            width={64}
            height={64}
            className="size-16"
          />
          <h1 className="text-3xl font-medium">Sign in to Root</h1>
          <p className="text-center text-base text-muted-foreground">
            You and an agent share the same live apps on Root.
          </p>
        </header>
        <SignInForm />
      </main>
    </div>
  );
}
