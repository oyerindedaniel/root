import { describe, expect, it } from "vitest";

import {
  createDocumentToolGrantGate,
  documentToolGrantsMessage,
  parseDocumentToolGrantsMessage,
} from "../src/document-tool-grants.js";

const rootOrigin = "http://localhost:3000";
const labOrigin = "http://localhost:3004";

describe("parseDocumentToolGrantsMessage", () => {
  it("reads the grant list only from the Root origin", () => {
    expect(
      parseDocumentToolGrantsMessage(
        documentToolGrantsMessage(["ping"]),
        rootOrigin,
        rootOrigin,
      ),
    ).toEqual(["ping"]);
    expect(
      parseDocumentToolGrantsMessage(
        documentToolGrantsMessage(["ping"]),
        labOrigin,
        rootOrigin,
      ),
    ).toBeNull();
  });
});

describe("createDocumentToolGrantGate", () => {
  it("refuses until Root posts a grant, then allows that tool only", () => {
    const gate = createDocumentToolGrantGate(rootOrigin);
    expect(() => gate.requireGranted("ping")).toThrow(
      "This tool has not been granted by the user.",
    );
    gate.applyMessage(documentToolGrantsMessage(["ping"]), rootOrigin);
    expect(() => gate.requireGranted("ping")).not.toThrow();
    expect(() => gate.requireGranted("set_status")).toThrow(
      "This tool has not been granted by the user.",
    );
  });

  it("wraps execute so an ungranted tool never runs", async () => {
    const gate = createDocumentToolGrantGate(rootOrigin);
    let ran = false;
    const execute = gate.guard("ping", async () => {
      ran = true;
      return "ok";
    });
    expect(() => {
      void execute();
    }).toThrow("This tool has not been granted by the user.");
    expect(ran).toBe(false);
    gate.applyMessage(documentToolGrantsMessage(["ping"]), rootOrigin);
    await expect(execute()).resolves.toBe("ok");
    expect(ran).toBe(true);
  });
});
