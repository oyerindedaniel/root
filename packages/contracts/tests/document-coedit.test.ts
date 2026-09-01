import { describe, expect, it } from "vitest";

import {
  coeditMessage,
  parseCoeditMessage,
  WEBMCP_COEDIT_TYPE,
} from "../src/document-coedit.js";

const shopOrigin = "http://localhost:3002";
const rootOrigin = "http://localhost:3000";

describe("parseCoeditMessage", () => {
  it("reads an open payload from the provider origin", () => {
    expect(parseCoeditMessage(coeditMessage(true), shopOrigin, shopOrigin)).toBe(
      true,
    );
    expect(
      parseCoeditMessage(coeditMessage(false), shopOrigin, shopOrigin),
    ).toBe(false);
  });

  it("ignores a payload from the wrong origin", () => {
    expect(
      parseCoeditMessage(
        { type: WEBMCP_COEDIT_TYPE, open: true },
        rootOrigin,
        shopOrigin,
      ),
    ).toBeNull();
  });
});
