import { describe, expect, expectTypeOf, it } from "vitest";

import type { Customer } from "../src/customers.js";
import type { SupportCase } from "../src/cases.js";
import type { ShopProduct } from "../src/shop.js";
import {
  boundedError,
  boundedResultEnvelopeSchema,
  boundedSuccess,
  discoverCapabilitiesOutputSchema,
  executeWorkflowOutputSchema,
  inspectWorkflowOutputSchema,
  invokeGrantedToolInputSchema,
  invokeGrantedToolOutputSchema,
  listProvidersOutputSchema,
  MAX_PREPARED_WORKFLOW_STEPS,
  MAX_PROVIDER_TOOLS,
  PASS_READ_TOOL_NAMES,
  prepareWorkflowInputJsonSchema,
  prepareWorkflowInputSchema,
  prepareWorkflowOutputSchema,
  proposedWorkflowStepSchema,
  webmcpToolNameSchema,
  workflowStepResultSchema,
  type ProposedWorkflowStep,
  type WorkflowStepResult,
} from "../src/index.js";

const customerResult = {
  tool: "accounts.search_customers" as const,
  data: {
    status: "success" as const,
    query: "ada",
    customers: [{ id: "c1", name: "Ada", email: "ada@localhost" }],
  },
};

const productResult = {
  tool: "shop.search_products" as const,
  data: {
    status: "success" as const,
    query: "keyboard",
    products: [
      {
        id: "p1",
        name: "Keyboard",
        description: "A keyboard",
        priceUsd: 40,
      },
    ],
  },
};

const caseResult = {
  tool: "support.search_cases" as const,
  data: {
    status: "success" as const,
    query: "hub",
    cases: [
      {
        id: "case-1",
        title: "USB-C hub not detected",
        customerName: "Ada",
        customerEmail: "ada@localhost",
        orderRef: "usb-hub",
        status: "open" as const,
      },
    ],
  },
};

function customerSearch(query: string) {
  return {
    providerId: "accounts" as const,
    tool: "search_customers" as const,
    arguments: { query },
  };
}

function jsonSchemaHasBind(value: unknown): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(value, "bind")) {
    return true;
  }
  for (const nested of Object.values(value)) {
    if (jsonSchemaHasBind(nested)) {
      return true;
    }
  }
  return false;
}

describe("proposed workflow steps", () => {
  it("keeps the step cap independent of the pass allowlist", () => {
    expect(MAX_PREPARED_WORKFLOW_STEPS).not.toBe(PASS_READ_TOOL_NAMES.length);
    expect(MAX_PREPARED_WORKFLOW_STEPS).not.toBe(MAX_PROVIDER_TOOLS);
  });

  it("accepts more allowlisted reads than the allowlist length", () => {
    expect(
      prepareWorkflowInputSchema.safeParse({
        steps: [
          customerSearch("ada"),
          customerSearch("lin"),
          {
            providerId: "support",
            tool: "search_cases",
            arguments: { query: "hub" },
          },
          {
            providerId: "shop",
            tool: "search_products",
            arguments: { query: "keyboard" },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects graphs longer than the safety cap", () => {
    expect(
      prepareWorkflowInputSchema.safeParse({
        steps: Array.from(
          { length: MAX_PREPARED_WORKFLOW_STEPS + 1 },
          (_, index) => customerSearch(`q${index}`),
        ),
      }).success,
    ).toBe(false);
  });

  it("accepts allowlisted customer, product, and case searches", () => {
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "accounts",
        tool: "search_customers",
        arguments: { query: "ada" },
      }).success,
    ).toBe(true);
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "shop",
        tool: "search_products",
        arguments: { query: "keyboard" },
      }).success,
    ).toBe(true);
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "support",
        tool: "search_cases",
        arguments: { query: "hub" },
      }).success,
    ).toBe(true);
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "support",
        tool: "search_cases",
        arguments: { query: { bind: { stepIndex: 0 } } },
      }).success,
    ).toBe(true);
  });

  it("exposes bind on the prepare JSON schema the agent sees", () => {
    expect(jsonSchemaHasBind(prepareWorkflowInputJsonSchema)).toBe(true);
  });

  it("rejects a mismatched provider and tool", () => {
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "shop",
        tool: "search_customers",
        arguments: { query: "ada" },
      }).success,
    ).toBe(false);
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "accounts",
        tool: "search_cases",
        arguments: { query: "hub" },
      }).success,
    ).toBe(false);
  });

  it("rejects extra argument keys", () => {
    expect(
      prepareWorkflowInputSchema.safeParse({
        steps: [
          {
            providerId: "shop",
            tool: "search_products",
            arguments: { query: "keyboard", extra: true },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("narrows proposed arguments by tool", () => {
    const step = proposedWorkflowStepSchema.parse({
      providerId: "shop",
      tool: "search_products",
      arguments: { query: "keyboard" },
    });
    if (step.tool === "search_products") {
      expectTypeOf(step.arguments.query).toEqualTypeOf<string>();
      expectTypeOf(step.providerId).toEqualTypeOf<"shop">();
    }
    expectTypeOf({
      providerId: "shop" as const,
      tool: "search_customers" as const,
      arguments: { query: "ada" },
    }).not.toMatchTypeOf<ProposedWorkflowStep>();
  });
});

describe("gateway envelopes", () => {
  it("accepts only protocol tool identities through 128 characters", () => {
    expect(webmcpToolNameSchema.safeParse("a".repeat(128)).success).toBe(true);
    expect(webmcpToolNameSchema.safeParse("a".repeat(129)).success).toBe(false);
    expect(webmcpToolNameSchema.safeParse("read report").success).toBe(false);
    expect(webmcpToolNameSchema.safeParse("read/report").success).toBe(false);
  });

  it("parses discover data inside the success envelope", () => {
    const data = discoverCapabilitiesOutputSchema.parse({
      providerId: "accounts",
      origin: "http://localhost:3001",
      contractVersion: "1.0.0",
      tools: [],
    });
    const envelope = boundedResultEnvelopeSchema.parse(boundedSuccess(data));
    expect(envelope.status).toBe("success");
    if (envelope.status === "success") {
      expect(
        discoverCapabilitiesOutputSchema.safeParse(envelope.data).success,
      ).toBe(true);
    }
  });

  it("parses dynamic discovery and provider summaries without workflow authority", () => {
    expect(
      discoverCapabilitiesOutputSchema.safeParse({
        providerId: "custom-analytics-1",
        origin: "https://analytics.example",
        contractVersion: null,
        tools: [],
      }).success,
    ).toBe(true);
    expect(
      listProvidersOutputSchema.parse({
        providers: [
          {
            providerId: "accounts",
            label: "Customers",
            source: "builtin",
            capability: "workflow-ready",
            passTools: ["search_customers"],
          },
          {
            providerId: "custom-analytics-1",
            label: "Analytics",
            source: "custom",
            capability: "discovery-only",
            grantedTools: [],
          },
        ],
      }).providers,
    ).toHaveLength(2);
    expect(
      listProvidersOutputSchema.safeParse({
        providers: [
          {
            providerId: "accounts",
            label: "Customers",
            source: "builtin",
            capability: "workflow-ready",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      proposedWorkflowStepSchema.safeParse({
        providerId: "custom-analytics-1",
        tool: "search_customers",
        arguments: { query: "ada" },
      }).success,
    ).toBe(false);
  });

  it("bounds discovered tools at the shared provider capacity", () => {
    const tool = {
      providerId: "custom-analytics-1",
      namespacedName: "custom-analytics-1.read_report",
      name: "read_report",
      title: "Read report",
      description: "Read report",
      origin: "https://analytics.example",
      inputSchema: { type: "object" },
      schemaFingerprint: "{}",
      invokeKind: "object",
      readOnlyHint: true,
      untrustedContentHint: false,
    };
    const tools = Array.from({ length: MAX_PROVIDER_TOOLS }, () => tool);
    expect(
      discoverCapabilitiesOutputSchema.safeParse({
        providerId: "custom-analytics-1",
        origin: "https://analytics.example",
        contractVersion: null,
        tools,
      }).success,
    ).toBe(true);
    expect(
      discoverCapabilitiesOutputSchema.safeParse({
        providerId: "custom-analytics-1",
        origin: "https://analytics.example",
        contractVersion: null,
        tools: [...tools, tool],
      }).success,
    ).toBe(false);
  });

  it("keeps granted custom invocation separate from typed workflow results", () => {
    expect(
      listProvidersOutputSchema.safeParse({
        providers: [
          {
            providerId: "custom-analytics-1",
            label: "Analytics",
            source: "custom",
            capability: "granted-invoke",
            grantedTools: ["read_report"],
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      invokeGrantedToolInputSchema.safeParse({
        providerId: "custom-analytics-1",
        tool: "read_report",
        arguments: {},
        origin: "https://analytics.example",
      }).success,
    ).toBe(false);
    expect(
      invokeGrantedToolOutputSchema.safeParse({
        providerId: "custom-analytics-1",
        tool: "read_report",
        untrusted: true,
        data: { rows: [] },
      }).success,
    ).toBe(true);
    expect(
      executeWorkflowOutputSchema.safeParse({
        results: [
          {
            providerId: "custom-analytics-1",
            tool: "read_report",
            untrusted: true,
            data: {},
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("reports every granted tool through the shared provider capacity", () => {
    const grantedTools = Array.from(
      { length: MAX_PROVIDER_TOOLS },
      (_, index) => `tool_${index}`,
    );
    const parsed = listProvidersOutputSchema.parse({
      providers: [
        {
          providerId: "custom-analytics-1",
          label: "Analytics",
          source: "custom",
          capability: "granted-invoke",
          grantedTools,
        },
      ],
    });
    expect(parsed.providers[0]).toMatchObject({ grantedTools });
    expect(
      listProvidersOutputSchema.safeParse({
        providers: [
          {
            providerId: "custom-analytics-1",
            label: "Analytics",
            source: "custom",
            capability: "granted-invoke",
            grantedTools: [...grantedTools, "overflow"],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a discover payload that is not wrapped in data", () => {
    expect(
      boundedResultEnvelopeSchema.safeParse({
        status: "success",
        providerId: "accounts",
        origin: "http://localhost:3001",
        contractVersion: "1.0.0",
        tools: [],
      }).success,
    ).toBe(false);
  });

  it("parses prepare and execute success payloads", () => {
    expect(
      prepareWorkflowOutputSchema.safeParse({
        workflowId: "wf_1",
        steps: [
          {
            providerId: "shop",
            origin: "http://localhost:3002",
            toolName: "search_products",
            namespacedName: "shop.search_products",
            schemaFingerprint: null,
            arguments: { query: "keyboard" },
            readOnly: true,
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      executeWorkflowOutputSchema.safeParse({
        results: [customerResult, productResult, caseResult],
      }).success,
    ).toBe(true);
  });

  it("parses inspect results as typed step records", () => {
    expect(
      inspectWorkflowOutputSchema.safeParse({
        workflowId: "wf_1",
        lifecycle: "passed",
        steps: [],
        step: null,
        results: [customerResult],
        evidence: '1 customers for "ada"',
        failureReason: null,
      }).success,
    ).toBe(true);
    expect(
      inspectWorkflowOutputSchema.safeParse({
        workflowId: "wf_1",
        lifecycle: "passed",
        steps: [],
        step: null,
        results: [customerResult.data],
        evidence: null,
        failureReason: null,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown error codes", () => {
    expect(boundedError("unsupported_graph", "Only one step.").code).toBe(
      "unsupported_graph",
    );
    expect(
      boundedError("operation_in_progress", "Another operation is active.").code,
    ).toBe("operation_in_progress");
    expect(boundedError("window_not_found", "No open window.").code).toBe(
      "window_not_found",
    );
    expect(
      boundedError("stopped_by_user", "The human took control.").code,
    ).toBe("stopped_by_user");
    expect(
      boundedError("no_response", "The human did not respond.").code,
    ).toBe("no_response");
    expect(() => boundedError("not_a_code" as never, "Nope.")).toThrow();
  });

  it("narrows workflow results by tool", () => {
    const result: WorkflowStepResult = workflowStepResultSchema.parse(
      productResult as unknown,
    );
    if (result.tool === "shop.search_products") {
      expectTypeOf(result.data.products).toEqualTypeOf<ShopProduct[]>();
    } else if (result.tool === "support.search_cases") {
      expectTypeOf(result.data.cases).toEqualTypeOf<SupportCase[]>();
    } else if (result.tool === "accounts.search_customers") {
      expectTypeOf(result.data.customers).toEqualTypeOf<Customer[]>();
    } else if (
      result.tool === "accounts.open_customer" ||
      result.tool === "accounts.create_customer" ||
      result.tool === "accounts.open_customer_by_id"
    ) {
      expectTypeOf(result.data.customer).toEqualTypeOf<Customer>();
    } else if (
      result.tool === "shop.open_product" ||
      result.tool === "shop.create_product" ||
      result.tool === "shop.open_product_by_id"
    ) {
      expectTypeOf(result.data.product).toEqualTypeOf<ShopProduct>();
    } else if (
      result.tool === "support.open_case" ||
      result.tool === "support.create_case" ||
      result.tool === "support.open_case_by_id"
    ) {
      expectTypeOf(result.data.case).toEqualTypeOf<SupportCase>();
    } else if (
      result.tool === "accounts.select_result" ||
      result.tool === "shop.select_result" ||
      result.tool === "support.select_result"
    ) {
      expectTypeOf(result.data.selected.sourceId).toEqualTypeOf<string>();
    }
  });
});
