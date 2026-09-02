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

import type { AbortErrorCode } from "./cancellation";

export type SessionStatus = "authenticated" | "signed-out";

export type WebmcpStatus = "unknown" | "available" | "unavailable";

export type ControlOwner = "human" | "agent";

export type RuntimeMotion =
  | { status: "idle" }
  | {
      status: "suction";
      instanceId: string;
      placement: ProviderPlacement;
      settle?: "unmount";
    };

export type ProviderWindow = {
  providerId: ProviderId;
  instanceId: string;
  origin: string;
  entryUrl: string;
  lifecycle: ProviderLifecycle;
  placement: ProviderPlacement;
  activeTool: string | null;
  failureReason: GatewayErrorCode | null;
  outcome: string | null;
  discoveredTools: NormalizedToolDescriptor[];
  openedBy: ControlOwner;
  control: ControlOwner;
  lastTouchedAt: number;
};

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
  failureReason: AbortErrorCode;
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
  windows: Record<string, ProviderWindow>;
  windowOrder: string[];
  focusedInstanceId: string | null;
  workflow: WorkflowState;
  motion: RuntimeMotion;
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
      openedBy: ControlOwner;
      touchedAt: number;
    }
  | { type: "provider/focus"; instanceId: string; touchedAt: number }
  | { type: "provider/loaded"; instanceId: string }
  | { type: "provider/discovering"; instanceId: string }
  | {
      type: "provider/ready";
      instanceId: string;
      tools: NormalizedToolDescriptor[];
    }
  | { type: "provider/active"; instanceId: string }
  | { type: "provider/failed"; instanceId?: string; reason: GatewayErrorCode }
  | { type: "provider/unmount"; instanceId: string }
  | { type: "handles/invalidate"; instanceId: string }
  | {
      type: "placement/request";
      instanceId: string;
      placement: ProviderPlacement;
      settle?: "unmount";
      instant?: true;
    }
  | { type: "placement/appear"; instanceId: string }
  | { type: "motion/finish"; instanceId: string }
  | { type: "motion/cancel"; instanceId: string }
  | {
      type: "control/set";
      instanceId: string;
      control: ControlOwner;
    }
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
  | {
      type: "workflow/cancelled";
      workflowId: string;
      reason?: AbortErrorCode;
    }
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
    windows: {},
    windowOrder: [],
    focusedInstanceId: null,
    workflow: createDraftWorkflow(),
    motion: { status: "idle" },
  };
}

export function emptyWorkflow() {
  return createDraftWorkflow();
}

export function findProviderWindow(
  state: RuntimeState,
  providerId: ProviderId,
): ProviderWindow | undefined {
  return Object.values(state.windows).find(
    (windowState) => windowState.providerId === providerId,
  );
}

export function focusedProviderWindow(
  state: RuntimeState,
): ProviderWindow | undefined {
  return state.focusedInstanceId
    ? state.windows[state.focusedInstanceId]
    : undefined;
}

export function waitingProviderIds(
  state: RuntimeState,
  pendingInstanceIds: string[],
): ProviderId[] {
  const ids: ProviderId[] = [];
  const seen = new Set<ProviderId>();
  for (const instanceId of pendingInstanceIds) {
    const windowState = state.windows[instanceId];
    if (!windowState || seen.has(windowState.providerId)) {
      continue;
    }
    seen.add(windowState.providerId);
    ids.push(windowState.providerId);
  }
  return ids;
}

export function dockPendingCue(
  windowState: ProviderWindow | undefined,
  pendingInstanceIds: string[],
  focusedInstanceId: string | null,
) {
  if (!windowState || !pendingInstanceIds.includes(windowState.instanceId)) {
    return false;
  }
  if (windowState.placement === "tray") {
    return true;
  }
  return windowState.instanceId !== focusedInstanceId;
}
