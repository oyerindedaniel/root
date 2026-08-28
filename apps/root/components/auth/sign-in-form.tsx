"use client";

import { authClient } from "@repo/api-client";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { PasswordField } from "@repo/ui/password-field";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function finish(ok: boolean, errorMessage?: string) {
    if (ok) {
      router.replace(nextPath);
      router.refresh();
      return;
    }
    setMessage(errorMessage ?? "Sign-in failed.");
    setPending(false);
  }

  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setMessage(null);
        void authClient
          .signIn.email({ email, password })
          .then((result) => finish(!result.error, result.error?.message));
      }}
    >
      <Label>
        Email
        <Input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="user@example.com"
          required
        />
      </Label>
      <Label>
        Password
        <PasswordField
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="user12345"
          required
          minLength={8}
        />
      </Label>
      <Button type="submit" pending={pending}>
        Sign in
      </Button>
      {message ? (
        <p className="text-xs text-destructive" role="alert">
          {message}
        </p>
      ) : null}
    </form>
  );
}
