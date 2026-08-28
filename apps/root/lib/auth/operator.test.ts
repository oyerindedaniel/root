import { describe, expect, it } from "vitest";

import { operatorFromSessionUser, workspaceEntry } from "./operator";

describe("operatorFromSessionUser", () => {
  it("maps a session user to operator identity", () => {
    expect(
      operatorFromSessionUser({
        id: "user_1",
        email: "dev@localhost",
        name: "Dev",
      }),
    ).toEqual({
      id: "user_1",
      email: "dev@localhost",
      name: "Dev",
    });
  });

  it("returns null without a session", () => {
    expect(operatorFromSessionUser(null)).toBeNull();
  });
});

describe("workspaceEntry", () => {
  it("redirects unauthenticated operators to sign-in", () => {
    expect(workspaceEntry(null)).toEqual({
      kind: "redirect",
      href: "/sign-in",
    });
  });

  it("admits a validated operator", () => {
    const operator = {
      id: "user_1",
      email: "dev@localhost",
      name: "Dev",
    };
    expect(workspaceEntry(operator)).toEqual({
      kind: "ok",
      operator,
    });
  });
});
