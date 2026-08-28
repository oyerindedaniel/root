"use client";

import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useState, type ComponentProps } from "react";

import { cn } from "./lib/cn";

export type PasswordFieldProps = Omit<ComponentProps<"input">, "type">;

export function PasswordField({
  className,
  disabled,
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        "flex h-8 w-full items-center rounded-md border border-border bg-background inset-shadow-highlight focus-within:ring-2 focus-within:ring-ring has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50",
        className,
      )}
    >
      <input
        type={visible ? "text" : "password"}
        disabled={disabled}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        {...props}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="mr-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? (
          <EyeSlashIcon className="size-3.5" aria-hidden />
        ) : (
          <EyeIcon className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
