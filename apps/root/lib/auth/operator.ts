import {
  operatorIdentitySchema,
  type OperatorIdentity,
} from "@repo/contracts";

import { buildSignInHref } from "./return-url";

export function operatorFromSessionUser(
  user: {
    id: string;
    email?: string | null;
    name?: string | null;
  } | null,
): OperatorIdentity | null {
  if (!user) {
    return null;
  }
  const parsed = operatorIdentitySchema.safeParse({
    id: user.id,
    email: user.email ?? "",
    name: user.name?.trim() || user.email || "Operator",
  });
  return parsed.success ? parsed.data : null;
}

export function workspaceEntry(
  operator: OperatorIdentity | null,
  fromPath = "/",
):
  | { kind: "ok"; operator: OperatorIdentity }
  | { kind: "redirect"; href: string } {
  if (!operator) {
    return { kind: "redirect", href: buildSignInHref(fromPath) };
  }
  return { kind: "ok", operator };
}
