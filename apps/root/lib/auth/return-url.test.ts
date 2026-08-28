import { describe, expect, it } from "vitest";

import { buildSignInHref, parseReturnPath } from "./return-url";

describe("parseReturnPath", () => {
  it("defaults to the workspace", () => {
    expect(parseReturnPath(undefined)).toBe("/");
  });

  it("rejects protocol-relative and absolute URLs", () => {
    expect(parseReturnPath("//evil.example")).toBe("/");
    expect(parseReturnPath("https://evil.example")).toBe("/");
    expect(parseReturnPath("/\\evil")).toBe("/");
  });

  it("rejects the sign-in path to avoid loops", () => {
    expect(parseReturnPath("/sign-in")).toBe("/");
    expect(parseReturnPath("/sign-in?from=/")).toBe("/");
  });

  it("allows a same-origin workspace path", () => {
    expect(parseReturnPath("/")).toBe("/");
  });
});

describe("buildSignInHref", () => {
  it("omits from when returning to the workspace root", () => {
    expect(buildSignInHref("/")).toBe("/sign-in");
  });
});
