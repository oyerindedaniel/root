import { describe, expect, it } from "vitest";

import {
  allowsRichDom,
  createDocumentVisibilityGate,
  documentVisibilityMessage,
  parseDocumentVisibilityMessage,
  WEBMCP_DOCUMENT_VISIBILITY_TYPE,
} from "../src/document-visibility.js";

const rootOrigin = "http://localhost:3000";

describe("allowsRichDom", () => {
  it("is false only when the document is not visible", () => {
    expect(allowsRichDom(true)).toBe(true);
    expect(allowsRichDom(false)).toBe(false);
  });
});

describe("parseDocumentVisibilityMessage", () => {
  it("reads a host visibility payload from the expected origin", () => {
    expect(
      parseDocumentVisibilityMessage(
        documentVisibilityMessage(false),
        rootOrigin,
        rootOrigin,
      ),
    ).toBe(false);
    expect(
      parseDocumentVisibilityMessage(
        { type: WEBMCP_DOCUMENT_VISIBILITY_TYPE, visible: true },
        "http://localhost:3002",
        rootOrigin,
      ),
    ).toBeNull();
  });
});

describe("createDocumentVisibilityGate", () => {
  it("skips reveal in the tray then reveals after the same instance returns to stage", () => {
    const gate = createDocumentVisibilityGate(true);
    const reveals: boolean[] = [];
    const executeSearch = () => {
      reveals.push(gate.shouldPresent());
    };
    gate.setVisible(false);
    executeSearch();
    gate.setVisible(true);
    executeSearch();
    expect(reveals).toEqual([false, true]);
  });

  it("applies a placement message through the same setter", () => {
    const gate = createDocumentVisibilityGate(true);
    expect(
      gate.applyMessage(
        documentVisibilityMessage(false),
        rootOrigin,
        rootOrigin,
      ),
    ).toBe(true);
    expect(gate.shouldPresent()).toBe(false);
    expect(
      gate.applyMessage(
        documentVisibilityMessage(true),
        rootOrigin,
        rootOrigin,
      ),
    ).toBe(true);
    expect(gate.shouldPresent()).toBe(true);
  });
});
