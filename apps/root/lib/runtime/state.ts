import type {
  Account,
  GatewayErrorCode,
  NormalizedToolDescriptor,
  PreparedWorkflowStep,
  ProviderId,
  ProviderLifecycle,
  ProviderPlacement,
  WorkflowStepResult,
} from "@repo/contracts";

export type SessionStatus = "authenticated" | "signed-out";

export type WebmcpStatus = "unknown" | "available" | "unavailable";

export type ControlOwner = "human" | "agent";

export type WorkflowDraft = {
  lifecycle: "draft";
  id: null;
  steps: [];
  currentStepIndex: 0;
  step: null;
  results: [];
  evidence: null;
  failureReason: null;
};

export type WorkflowPrepared = {
  lifecycle: "prepared";
  id: string;
  steps: PreparedWorkflowStep[];
  currentStepIndex: number;
  step: PreparedWorkflowStep | null;
  results: [];
  evidence: null;
  failureReason: null;
};

export type WorkflowExecuting = {
  lifecycle: "executing";
  id: string;
  steps: PreparedWorkflowStep[];
  currentStepIndex: number;
  step: PreparedWorkflowStep | null;
  results: WorkflowStepResult[];
  evidence: string | null;
  failureReason: null;
};

export type WorkflowPassed = {
  lifecycle: "passed";
  id: string;
  steps: PreparedWorkflowStep[];
  currentStepIndex: number;
  step: PreparedWorkflowStep | null;
  results: WorkflowStepResult[];
  evidence: string;
  failureReason: null;
};

export type WorkflowFailed = {
  lifecycle: "failed";
  id: string | null;
  steps: PreparedWorkflowStep[];
  currentStepIndex: number;
  step: PreparedWorkflowStep | null;
  results: WorkflowStepResult[];
  evidence: string | null;
  failureReason: GatewayErrorCode;
};

export type WorkflowCancelled = {
  lifecycle: "cancelled";
  id: string;
  steps: PreparedWorkflowStep[];
  currentStepIndex: number;
  step: PreparedWorkflowStep | null;
  results: WorkflowStepResult[];
  evidence: string | null;
  failureReason: "cancelled";
};

export type WorkflowState =
  | WorkflowDraft
  | WorkflowPrepared
  | WorkflowExecuting
  | WorkflowPassed
  | WorkflowFailed
  | WorkflowCancelled;

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
    failureReason: GatewayErrorCode | null;
    iframeRevision: number;
    outcome: string | null;
  };
  discoveredTools: NormalizedToolDescriptor[];
  workflow: WorkflowState;
  control: ControlOwner;
  motion: "idle" | "suction";
};

export type RuntimeAction =
  | { type: "session/ended" }
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
  | { type: "provider/failed"; instanceId?: string; reason: GatewayErrorCode }
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
      results: WorkflowStepResult[];
      evidence: string;
    }
  | { type: "workflow/failed"; workflowId?: string; reason: GatewayErrorCode }
  | { type: "workflow/cancelled"; workflowId: string }
  | { type: "workflow/invalidate" };

export function createDraftWorkflow(): WorkflowDraft {
  return {
    lifecycle: "draft",
    id: null,
    steps: [],
    currentStepIndex: 0,
    step: null,
    results: [],
    evidence: null,
    failureReason: null,
  };
}

export function toFailedWorkflow(
  workflow: WorkflowState,
  reason: GatewayErrorCode,
): WorkflowFailed {
  return {
    lifecycle: "failed",
    id: workflow.id,
    steps: [...workflow.steps],
    currentStepIndex: workflow.currentStepIndex,
    step: workflow.step,
    results: [...workflow.results],
    evidence: workflow.evidence,
    failureReason: reason,
  };
}

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
    workflow: createDraftWorkflow(),
    control: "human",
    motion: "idle",
  };
}

export function emptyWorkflow() {
  return createDraftWorkflow();
}
