import { describe, expect, it } from "vitest";

import { WEBMCP_DISCOVERY_TIMEOUT_MS } from "../src/webmcp.js";
import {
  parsePendingHumanMessage,
  PENDING_HUMAN_TIMEOUT_MS,
  pendingHumanMessage,
  parseSelectionModeMessage,
  selectionModeMessage,
  WEBMCP_PENDING_HUMAN_TYPE,
} from "../src/document-pending.js";

const shopOrigin = "http://localhost:3002";
const rootOrigin = "http://localhost:3000";

describe("PENDING_HUMAN_TIMEOUT_MS", () => {
  it("is longer than capability discovery", () => {
    expect(PENDING_HUMAN_TIMEOUT_MS).toBeGreaterThan(
      WEBMCP_DISCOVERY_TIMEOUT_MS,
    );
  });
});

describe("parsePendingHumanMessage", () => {
  it("reads an open payload from the provider origin", () => {
    expect(
      parsePendingHumanMessage(pendingHumanMessage(true), shopOrigin, shopOrigin),
    ).toBe(true);
    expect(
      parsePendingHumanMessage(
        pendingHumanMessage(false),
        shopOrigin,
        shopOrigin,
      ),
    ).toBe(false);
  });

  it("ignores a payload from the wrong origin", () => {
    expect(
      parsePendingHumanMessage(
        { type: WEBMCP_PENDING_HUMAN_TYPE, open: true },
        rootOrigin,
        shopOrigin,
      ),
    ).toBeNull();
  });
});

describe("parseSelectionModeMessage", () => {
  it("reads the configured mode only from the Root origin", () => {
    expect(
      parseSelectionModeMessage(
        selectionModeMessage("auto"),
        rootOrigin,
        rootOrigin,
      ),
    ).toBe("auto");
    expect(
      parseSelectionModeMessage(selectionModeMessage("auto"), shopOrigin, rootOrigin),
    ).toBeNull();
  });
});
