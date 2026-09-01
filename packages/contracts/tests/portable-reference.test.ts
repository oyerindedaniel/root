import { describe, expect, it } from "vitest";

import {
  caseSearchText,
  isBindQuery,
  portableCustomerReference,
  portableProductReference,
  portableReferenceSchema,
  workflowQueryLabel,
} from "../src/portable-reference.js";

const capturedAt = "2026-09-01T18:04:00.000Z";

const ada = portableCustomerReference(
  { id: "c1", name: "Ada Ortega", email: "ada@example.com" },
  capturedAt,
);

describe("portableReferenceSchema", () => {
  it("accepts a customer snapshot and not a bind placeholder", () => {
    expect(portableReferenceSchema.safeParse(ada).success).toBe(true);
    expect(
      portableReferenceSchema.safeParse({ bind: { stepIndex: 0 } }).success,
    ).toBe(false);
    expect(isBindQuery({ bind: { stepIndex: 0 } })).toBe(true);
    expect(isBindQuery(ada)).toBe(false);
  });
});

describe("caseSearchText", () => {
  it("uses the customer email and ignores other entity types", () => {
    expect(caseSearchText(ada)).toBe("ada@example.com");
    expect(
      caseSearchText(
        portableProductReference(
          {
            id: "p1",
            name: "Keyboard",
            description: "A keyboard",
            priceUsd: 40,
          },
          capturedAt,
        ),
      ),
    ).toBeNull();
  });
});

describe("workflowQueryLabel", () => {
  it("names a snapshot and a bind without dumping JSON", () => {
    expect(workflowQueryLabel("ada")).toBe("ada");
    expect(workflowQueryLabel(ada)).toBe("Ada Ortega");
    expect(workflowQueryLabel({ bind: { stepIndex: 0 } })).toBe("Bound");
  });
});
