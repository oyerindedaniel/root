import type {
  Account,
  NormalizedToolDescriptor,
  PreparedWorkflowStep,
  ProviderId,
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
  account: Account;
  provider: {
    providerId: ProviderId | null;
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
    steps: PreparedWorkflowStep[];
    currentStepIndex: number;
    step: PreparedWorkflowStep | null;
    results: unknown[];
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
  | {
      type: "provider/mount";
      providerId: ProviderId;
      instanceId: string;
      origin: string;
      entryUrl: string;
    }
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
  | {
      type: "workflow/prepared";
      steps: PreparedWorkflowStep[];
      workflowId: string;
    }
  | { type: "workflow/executing"; workflowId: string }
  | { type: "workflow/step"; workflowId: string; index: number }
  | {
      type: "workflow/passed";
      workflowId: string;
      result: unknown;
      results: unknown[];
      evidence: string;
    }
  | { type: "workflow/failed"; workflowId?: string; reason: string }
  | { type: "workflow/cancelled"; workflowId: string }
  | { type: "workflow/invalidate" };

export function createInitialRuntimeState(account: Account): RuntimeState {
  return {
    sessionStatus: "authenticated",
    webmcpStatus: "unknown",
    account,
    provider: {
      providerId: null,
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
      steps: [],
      currentStepIndex: 0,
      step: null,
      results: [],
      result: null,
      failureReason: null,
      evidence: null,
    },
    control: "human",
    motion: "idle",
  };
}

export function emptyWorkflow(account: Account) {
  return createInitialRuntimeState(account).workflow;
}
