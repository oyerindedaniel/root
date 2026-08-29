import {
  createInitialRuntimeState,
  emptyWorkflow,
  type RuntimeAction,
  type RuntimeState,
} from "./state";

export function runtimeReducer(
  state: RuntimeState,
  action: RuntimeAction,
): RuntimeState {
  switch (action.type) {
    case "session/signed-out":
      return { ...state, sessionStatus: "signed-out", control: "human" };
    case "webmcp/available":
      return { ...state, webmcpStatus: "available" };
    case "webmcp/unavailable":
      return { ...state, webmcpStatus: "unavailable" };
    case "provider/mount":
      return {
        ...state,
        provider: {
          providerId: action.providerId,
          instanceId: action.instanceId,
          origin: action.origin,
          entryUrl: action.entryUrl,
          lifecycle: "mounting",
          placement: "stage",
          activeTool: null,
          failureReason: null,
          iframeRevision: state.provider.iframeRevision,
          outcome: null,
        },
        discoveredTools: [],
      };
    case "provider/loaded":
      if (state.provider.instanceId !== action.instanceId) {
        return state;
      }
      return {
        ...state,
        provider: {
          ...state.provider,
          lifecycle: "loaded",
          iframeRevision: state.provider.iframeRevision + 1,
          failureReason: null,
        },
        discoveredTools: [],
      };
    case "provider/discovering":
      if (state.provider.instanceId !== action.instanceId) {
        return state;
      }
      return {
        ...state,
        provider: { ...state.provider, lifecycle: "discovering" },
      };
    case "provider/ready":
      if (state.provider.instanceId !== action.instanceId) {
        return state;
      }
      return {
        ...state,
        provider: {
          ...state.provider,
          lifecycle:
            state.provider.placement === "stage" ? "active" : "ready",
          failureReason: null,
        },
        discoveredTools: action.tools,
      };
    case "provider/active":
      if (state.provider.instanceId !== action.instanceId) {
        return state;
      }
      return {
        ...state,
        provider: { ...state.provider, lifecycle: "active", placement: "stage" },
      };
    case "provider/failed":
      if (
        action.instanceId &&
        state.provider.instanceId !== action.instanceId
      ) {
        return state;
      }
      return {
        ...state,
        provider: {
          ...state.provider,
          lifecycle: "failed",
          failureReason: action.reason,
        },
      };
    case "provider/unmount":
      return {
        ...createInitialRuntimeState(state.account),
        sessionStatus: state.sessionStatus,
        webmcpStatus: state.webmcpStatus,
      };
    case "handles/invalidate":
      if (state.provider.instanceId !== action.instanceId) {
        return state;
      }
      return {
        ...state,
        discoveredTools: [],
        workflow:
          state.workflow.lifecycle === "prepared"
            ? {
                ...state.workflow,
                lifecycle: "failed",
                failureReason: "stale_handle",
              }
            : state.workflow,
      };
    case "placement/request":
      if (state.motion === "suction") {
        return state;
      }
      return { ...state, motion: "suction" };
    case "motion/start":
      return { ...state, motion: "suction" };
    case "motion/finish":
      return {
        ...state,
        motion: "idle",
        provider: {
          ...state.provider,
          placement: action.placement,
          lifecycle:
            action.placement === "stage" &&
            (state.provider.lifecycle === "ready" ||
              state.provider.lifecycle === "active")
              ? "active"
              : action.placement === "tray" &&
                  state.provider.lifecycle === "active"
                ? "ready"
                : state.provider.lifecycle,
        },
      };
    case "control/set":
      return { ...state, control: action.control };
    case "workflow/draft":
      return {
        ...state,
        workflow: emptyWorkflow(state.account),
        provider: { ...state.provider, activeTool: null, outcome: null },
      };
    case "workflow/prepared": {
      const step = action.steps[0] ?? null;
      return {
        ...state,
        workflow: {
          id: action.workflowId,
          lifecycle: "prepared",
          steps: action.steps,
          currentStepIndex: 0,
          step,
          results: [],
          result: null,
          failureReason: null,
          evidence: null,
        },
        provider: {
          ...state.provider,
          activeTool: step?.namespacedName ?? null,
          outcome: null,
        },
      };
    }
    case "workflow/executing":
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      return {
        ...state,
        workflow: { ...state.workflow, lifecycle: "executing" },
        provider: { ...state.provider, lifecycle: "executing" },
        control: "agent",
      };
    case "workflow/step": {
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      const step = state.workflow.steps[action.index] ?? null;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          currentStepIndex: action.index,
          step,
        },
        provider: {
          ...state.provider,
          activeTool: step?.namespacedName ?? state.provider.activeTool,
        },
      };
    }
    case "workflow/passed":
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      return {
        ...state,
        workflow: {
          ...state.workflow,
          lifecycle: "passed",
          result: action.result,
          results: action.results,
          evidence: action.evidence,
          failureReason: null,
        },
        provider: {
          ...state.provider,
          lifecycle: state.provider.placement === "stage" ? "active" : "ready",
          outcome: "passed",
        },
        control: "human",
      };
    case "workflow/failed":
      if (action.workflowId && state.workflow.id !== action.workflowId) {
        return state;
      }
      return {
        ...state,
        workflow: {
          ...state.workflow,
          lifecycle: "failed",
          failureReason: action.reason,
        },
        provider: {
          ...state.provider,
          lifecycle:
            state.provider.lifecycle === "unmounted"
              ? "unmounted"
              : state.provider.placement === "stage"
                ? "active"
                : state.provider.lifecycle === "mounting" ||
                    state.provider.lifecycle === "discovering"
                  ? "failed"
                  : "ready",
          outcome: "failed",
          failureReason:
            state.provider.lifecycle === "discovering" ||
            state.provider.lifecycle === "mounting"
              ? action.reason
              : state.provider.failureReason,
        },
        control: "human",
      };
    case "workflow/cancelled":
      if (state.workflow.id !== action.workflowId) {
        return state;
      }
      return {
        ...state,
        workflow: {
          ...state.workflow,
          lifecycle: "cancelled",
          failureReason: "cancelled",
        },
        provider: {
          ...state.provider,
          lifecycle: state.provider.placement === "stage" ? "active" : "ready",
          outcome: "cancelled",
        },
        control: "human",
      };
    case "workflow/invalidate":
      return {
        ...state,
        workflow: {
          ...state.workflow,
          lifecycle: "failed",
          failureReason: "revalidation_failed",
        },
      };
    default:
      return state;
  }
}
