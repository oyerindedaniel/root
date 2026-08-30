import { describe, expect, it } from "vitest";

import {
  dockRemovalCandidate,
  parseDockReference,
  serializeDockReference,
} from "./drag";

describe("Dock drag payload", () => {
  it("round-trips provider references", () => {
    expect(
      parseDockReference(
        serializeDockReference({
          kind: "provider",
          id: "custom-analytics-1",
        }),
      ),
    ).toEqual({ kind: "provider", id: "custom-analytics-1" });
    expect(
      parseDockReference(
        serializeDockReference({ kind: "provider", id: "support" }),
      ),
    ).toEqual({ kind: "provider", id: "support" });
  });

  it("rejects malformed or authority-bearing drag payloads", () => {
    expect(parseDockReference("{")).toBeNull();
    expect(
      parseDockReference(
        JSON.stringify({
          kind: "provider",
          id: "custom-analytics-1",
          entryUrl: "https://attacker.example",
        }),
      ),
    ).toBeNull();
  });
});

describe("Dock removal threshold", () => {
  const bounds = { top: 700, right: 700, bottom: 770, left: 300 };

  it("requires crossing the virtual boundary before removal", () => {
    expect(
      dockRemovalCandidate(bounds, { x: 500, y: 650 }, 84),
    ).toBe(false);
    expect(
      dockRemovalCandidate(bounds, { x: 500, y: 610 }, 84),
    ).toBe(true);
  });

  it("restores the item when released inside or near the Dock", () => {
    expect(
      dockRemovalCandidate(bounds, { x: 500, y: 720 }, 84),
    ).toBe(false);
    expect(
      dockRemovalCandidate(bounds, { x: 250, y: 720 }, 84),
    ).toBe(false);
  });
});
