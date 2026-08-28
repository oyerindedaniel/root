import type {
  NormalizedToolDescriptor,
  OperatorIdentity,
  PreparedShopSearchStep,
  ProviderLifecycle,
  ProviderPlacement,
  WorkflowLifecycle,
} from "@repo/contracts";

export type SessionStatus = "authenticated" | "signed-out";

export type WebmcpStatus = "unknown" | "available" | "unavailable";

export type ControlOwner = "human" | "agent";

export type RuntimeState = {
  sessionStatus: SessionStatus;
  webmcpStatus: WebmcpStatus;
  operator: OperatorIdentity;
  provider: {
    instanceId: string | null;
    origin: string | null;
    entryUrl: string | null;
    lifecycle: ProviderLifecycle;
    placement: ProviderPlacement;
    activeTool: string | null;
    failureReason: string | null;
    iframeRevision: number;
    outcome: string | null;
  };
  discoveredTools: NormalizedToolDescriptor[];
  workflow: {
    id: string | null;
    lifecycle: WorkflowLifecycle;
    step: PreparedShopSearchStep | null;
    result: unknown | null;
    failureReason: string | null;
    evidence: string | null;
  };
  control: ControlOwner;
  motion: "idle" | "suction";
};

export type RuntimeAction =
  | { type: "session/signed-out" }
  | { type: "webmcp/available" }
  | { type: "webmcp/unavailable" }
  | { type: "provider/mount"; instanceId: string; origin: string; entryUrl: string }
  | { type: "provider/loaded"; instanceId: string }
  | { type: "provider/discovering"; instanceId: string }
  | {
      type: "provider/ready";
      instanceId: string;
      tools: NormalizedToolDescriptor[];
    }
  | { type: "provider/active"; instanceId: string }
  | { type: "provider/failed"; instanceId?: string; reason: string }
  | { type: "provider/unmount" }
  | { type: "handles/invalidate"; instanceId: string }
  | { type: "placement/request"; placement: ProviderPlacement }
  | { type: "motion/start" }
  | { type: "motion/finish"; placement: ProviderPlacement }
  | { type: "control/set"; control: ControlOwner }
  | { type: "workflow/draft" }
  | { type: "workflow/prepared"; step: PreparedShopSearchStep; workflowId: string }
  | { type: "workflow/executing"; workflowId: string }
  | { type: "workflow/passed"; workflowId: string; result: unknown; evidence: string }
  | { type: "workflow/failed"; workflowId?: string; reason: string }
  | { type: "workflow/cancelled"; workflowId: string }
  | { type: "workflow/invalidate" };

export function createInitialRuntimeState(
  operator: OperatorIdentity,
): RuntimeState {
  return {
    sessionStatus: "authenticated",
    webmcpStatus: "unknown",
    operator,
    provider: {
      instanceId: null,
      origin: null,
      entryUrl: null,
      lifecycle: "unmounted",
      placement: "stage",
      activeTool: null,
      failureReason: null,
      iframeRevision: 0,
      outcome: null,
    },
    discoveredTools: [],
    workflow: {
      id: null,
      lifecycle: "draft",
      step: null,
      result: null,
      failureReason: null,
      evidence: null,
    },
    control: "human",
    motion: "idle",
  };
}
