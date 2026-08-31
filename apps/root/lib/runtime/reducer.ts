import {
  createDraftWorkflow,
  findProviderWindow,
  toFailedWorkflow,
  type ProviderWindow,
  type RuntimeAction,
  type RuntimeState,
  type WorkflowState,
  type WorkflowCancelled,
  type WorkflowExecuting,
  type WorkflowPassed,
  type WorkflowPrepared,
} from "./state";

function updateWindow(
  state: RuntimeState,
  instanceId: string,
  update: (windowState: ProviderWindow) => ProviderWindow,
): RuntimeState {
  const windowState = state.windows[instanceId];
  if (!windowState) {
    return state;
  }
  return {
    ...state,
    windows: {
      ...state.windows,
      [instanceId]: update(windowState),
    },
  };
}

function focusWindow(
  state: RuntimeState,
  instanceId: string,
  touchedAt?: number,
): RuntimeState {
  const windowState = state.windows[instanceId];
  if (!windowState) {
    return state;
  }
  return {
    ...state,
    windows: touchedAt === undefined
      ? state.windows
      : {
          ...state.windows,
          [instanceId]: { ...windowState, lastTouchedAt: touchedAt },
        },
    windowOrder: [
      ...state.windowOrder.filter((candidate) => candidate !== instanceId),
      instanceId,
    ],
    focusedInstanceId: instanceId,
  };
}

function unmountWindow(state: RuntimeState, instanceId: string): RuntimeState {
  if (!state.windows[instanceId]) {
    return state;
  }
  const windows = { ...state.windows };
  delete windows[instanceId];
  const windowOrder = state.windowOrder.filter(
    (candidate) => candidate !== instanceId,
  );
  return {
    ...state,
    windows,
    windowOrder,
    motion:
      state.motion.status === "suction" &&
      state.motion.instanceId === instanceId
        ? { status: "idle" }
        : state.motion,
    focusedInstanceId:
      state.focusedInstanceId === instanceId
        ? (windowOrder.at(-1) ?? null)
        : state.focusedInstanceId,
  };
}

function updateStepWindow(
  state: RuntimeState,
  update: (windowState: ProviderWindow) => ProviderWindow,
): RuntimeState {
  const providerId = state.workflow.step?.providerId;
  if (!providerId) {
    return state;
  }
  const windowState = findProviderWindow(state, providerId);
  return windowState
    ? updateWindow(state, windowState.instanceId, update)
    : state;
}

function settleLifecycle(windowState: ProviderWindow): ProviderWindow {
  return {
    ...windowState,
    lifecycle: windowState.placement === "stage" ? "active" : "ready",
  };
}

function selectWorkflowStep(
  workflow: WorkflowState,
  index: number,
): WorkflowState {
  if (workflow.lifecycle === "draft") {
    return workflow;
  }
  return {
    ...workflow,
    currentStepIndex: index,
    step: workflow.steps[index] ?? null,
  };
}

export function runtimeReducer(
  state: RuntimeState,
  action: RuntimeAction,
): RuntimeState {
  switch (action.type) {
    case "session/ended":
      if (state.sessionStatus === "signed-out") {
        return state;
      }
      return {
        ...state,
        sessionStatus: "signed-out",
        control: "human",
        motion: { status: "idle" },
      };
    case "webmcp/available":
      return { ...state, webmcpStatus: "available" };
    case "webmcp/unavailable":
      return { ...state, webmcpStatus: "unavailable" };
    case "provider/mount":
      return focusWindow({
        ...state,
        windows: {
          ...state.windows,
          [action.instanceId]: {
          providerId: action.providerId,
          instanceId: action.instanceId,
          origin: action.origin,
          entryUrl: action.entryUrl,
          lifecycle: "mounting",
          placement: "stage",
          activeTool: null,
          failureReason: null,
          outcome: null,
            discoveredTools: [],
            openedBy: action.openedBy,
            lastTouchedAt: action.touchedAt,
          },
        },
        windowOrder: [...state.windowOrder, action.instanceId],
      }, action.instanceId);
    case "provider/focus":
      return focusWindow(state, action.instanceId, action.touchedAt);
    case "provider/loaded":
      return updateWindow(state, action.instanceId, (windowState) => ({
          ...windowState,
          lifecycle: "loaded",
          failureReason: null,
          discoveredTools: [],
      }));
    case "provider/discovering":
      return updateWindow(state, action.instanceId, (windowState) => ({
        ...windowState,
        lifecycle: "discovering",
      }));
    case "provider/ready":
      return updateWindow(state, action.instanceId, (windowState) => ({
          ...windowState,
          lifecycle:
            windowState.placement === "stage" ? "active" : "ready",
          failureReason: null,
          discoveredTools: action.tools,
      }));
    case "provider/active":
      return updateWindow(state, action.instanceId, (windowState) => ({
        ...windowState,
        lifecycle: "active",
        placement: "stage",
      }));
    case "provider/failed": {
      const instanceId = action.instanceId ?? state.focusedInstanceId;
      if (!instanceId) {
        return state;
      }
      return updateWindow(state, instanceId, (windowState) => ({
          ...windowState,
          lifecycle: "failed",
          failureReason: action.reason,
      }));
    }
    case "provider/unmount":
      return unmountWindow(state, action.instanceId);
    case "handles/invalidate":
      if (!state.windows[action.instanceId]) {
        return state;
      }
      return updateWindow({
        ...state,
        workflow:
          state.workflow.lifecycle === "prepared" &&
          state.workflow.steps.some(
            (step) =>
              step.providerId === state.windows[action.instanceId]?.providerId,
          )
            ? toFailedWorkflow(state.workflow, "stale_handle")
            : state.workflow,
      }, action.instanceId, (windowState) => ({
        ...windowState,
        discoveredTools: [],
      }));
    case "placement/request": {
      const windowState = state.windows[action.instanceId];
      if (
        state.motion.status === "suction" ||
        !windowState ||
        windowState.placement === action.placement
      ) {
        return state;
      }
      return {
        ...state,
        motion: {
          status: "suction",
          instanceId: action.instanceId,
          placement: action.placement,
          ...(action.settle === "unmount" ? { settle: "unmount" } : {}),
        },
      };
    }
    case "placement/appear": {
      const windowState = state.windows[action.instanceId];
      if (
        state.motion.status === "suction" ||
        !windowState ||
        windowState.placement !== "stage"
      ) {
        return state;
      }
      return {
        ...state,
        motion: {
          status: "suction",
          instanceId: action.instanceId,
          placement: "stage",
        },
      };
    }
    case "motion/finish": {
      if (
        state.motion.status !== "suction" ||
        state.motion.instanceId !== action.instanceId
      ) {
        return state;
      }
      if (state.motion.settle === "unmount") {
        return unmountWindow(state, action.instanceId);
      }
      const placement = state.motion.placement;
      return updateWindow({
        ...state,
        motion: { status: "idle" },
      }, action.instanceId, (windowState) => ({
          ...windowState,
          placement,
          lifecycle:
            placement === "stage" &&
            (windowState.lifecycle === "ready" ||
              windowState.lifecycle === "active")
              ? "active"
              : placement === "tray" &&
                  windowState.lifecycle === "active"
                ? "ready"
                : windowState.lifecycle,
      }));
    }
    case "motion/cancel":
      return state.motion.status === "suction" &&
        state.motion.instanceId === action.instanceId
        ? { ...state, motion: { status: "idle" } }
        : state;
    case "control/set":
      return { ...state, control: action.control };
    case "workflow/draft": {
      const windowState = state.workflow.step
        ? findProviderWindow(state, state.workflow.step.providerId)
        : undefined;
      const next = {
        ...state,
        workflow: createDraftWorkflow(),
      };
      return windowState
        ? updateWindow(next, windowState.instanceId, (currentWindow) => ({
            ...currentWindow,
            activeTool: null,
            outcome: null,
          }))
        : next;
    }
    case "workflow/prepared": {
      const step = action.steps[0] ?? null;
      const workflow: WorkflowPrepared = {
        lifecycle: "prepared",
        id: action.workflowId,
        steps: action.steps,
        currentStepIndex: 0,
        step,
        results: [],
        evidence: null,
        failureReason: null,
      };
      const next = {
        ...state,
        workflow,
      };
      const windowState = step
        ? findProviderWindow(state, step.providerId)
        : undefined;
      return windowState
        ? updateWindow(next, windowState.instanceId, (currentWindow) => ({
          ...currentWindow,
          activeTool: step?.namespacedName ?? null,
          outcome: null,
        }))
        : next;
    }
    case "workflow/executing": {
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      const current = state.workflow;
      const workflow: WorkflowExecuting = {
        lifecycle: "executing",
        id: action.workflowId,
        steps: [...current.steps],
        currentStepIndex: current.currentStepIndex,
        step: current.step,
        results: [...current.results],
        evidence: current.evidence,
        failureReason: null,
      };
      return updateStepWindow({
        ...state,
        workflow,
        control: "agent",
      }, (windowState) => ({ ...windowState, lifecycle: "executing" }));
    }
    case "workflow/step": {
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      const workflow = selectWorkflowStep(state.workflow, action.index);
      const step = workflow.step;
      const previous = updateStepWindow(state, settleLifecycle);
      const next: RuntimeState = {
        ...previous,
        workflow,
      };
      const windowState = step
        ? findProviderWindow(next, step.providerId)
        : undefined;
      return windowState
        ? focusWindow(
            updateWindow(next, windowState.instanceId, (currentWindow) => ({
              ...currentWindow,
              lifecycle: "executing",
              activeTool:
                step?.namespacedName ?? currentWindow.activeTool,
            })),
            windowState.instanceId,
          )
        : next;
    }
    case "workflow/passed": {
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      const current = state.workflow;
      const workflow: WorkflowPassed = {
        lifecycle: "passed",
        id: action.workflowId,
        steps: [...current.steps],
        currentStepIndex: current.currentStepIndex,
        step: current.step,
        results: action.results,
        evidence: action.evidence,
        failureReason: null,
      };
      return updateStepWindow({
        ...state,
        workflow,
        control: "human",
      }, (windowState) => ({
          ...settleLifecycle(windowState),
          outcome: "passed",
      }));
    }
    case "workflow/failed":
      if (action.workflowId && state.workflow.id !== action.workflowId) {
        return state;
      }
      return updateStepWindow({
        ...state,
        workflow: toFailedWorkflow(state.workflow, action.reason),
        control: "human",
      }, (windowState) => ({
          ...windowState,
          lifecycle: windowState.placement === "stage"
                ? "active"
                : windowState.lifecycle === "mounting" ||
                    windowState.lifecycle === "discovering"
                  ? "failed"
                  : "ready",
          outcome: "failed",
          failureReason:
            windowState.lifecycle === "discovering" ||
            windowState.lifecycle === "mounting"
              ? action.reason
              : windowState.failureReason,
      }));
    case "workflow/cancelled": {
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      const current = state.workflow;
      if (current.id === null) {
        return state;
      }
      const workflow: WorkflowCancelled = {
        lifecycle: "cancelled",
        id: current.id,
        steps: [...current.steps],
        currentStepIndex: current.currentStepIndex,
        step: current.step,
        results: [...current.results],
        evidence: current.evidence,
        failureReason: "cancelled",
      };
      return updateStepWindow({
        ...state,
        workflow,
        control: "human",
      }, (windowState) => ({
          ...settleLifecycle(windowState),
          outcome: "cancelled",
      }));
    }
    case "workflow/invalidate":
      return {
        ...state,
        workflow: toFailedWorkflow(state.workflow, "revalidation_failed"),
      };
    default:
      return state;
  }
}
