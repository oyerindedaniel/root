"use client";

import {
  boundedError,
  boundedSuccess,
  documentVisibilityMessage,
  GatewayError,
  parseCoeditMessage,
  parsePendingHumanMessage,
  PENDING_HUMAN_TIMEOUT_MS,
  presentationCancelMessage,
  presentPaceMessage,
  type Account,
  type BoundedError,
  type BoundedResultEnvelope,
  type CancelWorkflowInput,
  type CancelWorkflowOutput,
  type DiscoverCapabilitiesInput,
  type DiscoverCapabilitiesOutput,
  type ExecuteWorkflowInput,
  type ExecuteWorkflowOutput,
  type InspectWorkflowInput,
  type InspectWorkflowOutput,
  type InvokeGrantedToolInput,
  type InvokeGrantedToolOutput,
  type ListProvidersOutput,
  type PrepareWorkflowInput,
  type PrepareWorkflowOutput,
  type PresentPace,
  type ProviderId,
  type ProviderPlacement,
  type WindowChromeInput,
  type WindowChromeOutput,
} from "@repo/contracts";
import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { AppWindow } from "@/components/workspace/app-window";
import { PlacementMotionDebug } from "@/components/workspace/placement-motion-debug";
import { SignedOutState } from "@/components/workspace/signed-out-state";
import { layoutFromRect } from "@/lib/window/frame";
import {
  animatePlacement,
  clearPlacementPresentation,
} from "@/lib/window/placement-motion";
import { createWindowSession, type WindowSession } from "@/lib/window/session";
import {
  getBuiltinProvider,
  type ProviderDirectory,
} from "@/lib/providers/directory";
import {
  getProvider,
  hasProvider,
  providerKey,
  type ProviderCatalog,
} from "@/lib/providers/catalog";
import { useProviderLibrary } from "@/lib/providers/provider-library";
import {
  LIVE_PROVIDER_CAP,
  liveWindowCount,
  pickEvictionVictim,
} from "@/lib/runtime/evict-window";
import { executePass } from "@/lib/runtime/execute-pass";
import { GatewayRegistrar } from "@/lib/runtime/gateway-registrar";
import { invokeGrantedTool as runGrantedTool } from "@/lib/runtime/invoke-granted";
import {
  abortErrorCode,
  abortErrorMessage,
  noResponseAbort,
  stoppedByUserAbort,
} from "@/lib/runtime/cancellation";
import {
  createBrowserPendingHumanNotifyHost,
  pendingHumanNotifyPermitted,
  syncPendingHumanNotification,
  type PendingHumanNotification,
} from "@/lib/runtime/pending-human-notify";
import { setPendingHumanTimer } from "@/lib/runtime/pending-human-timeout";
import {
  abortInstance,
  adoptInstanceAbort,
  dropInstanceAbort,
} from "@/lib/runtime/operation-abort";
import { acquireOperationLease } from "@/lib/runtime/operation-lease";
import {
  createPassMinimizeQueue,
} from "@/lib/runtime/pass-minimize";
import { prepareWorkflow as bindWorkflow } from "@/lib/runtime/prepare";
import { runtimeReducer } from "@/lib/runtime/reducer";
import { resolveOpenWindow } from "@/lib/runtime/window-chrome";
import {
  RuntimeContextProvider,
  type RuntimeApi,
} from "@/lib/runtime/runtime-context";
import { SessionWatcher } from "@/lib/runtime/session-watcher";
import {
  createInitialRuntimeState,
  findProviderWindow,
  waitingProviderIds,
  type ControlOwner,
  type ProviderWindow,
  type RuntimeAction,
  type RuntimeMotion,
} from "@/lib/runtime/state";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";
import { discoverTools } from "@/lib/webmcp/discover";
import { ToolHandleRegistry } from "@/lib/webmcp/handles";
import {
  assertProviderToolCapacity,
  normalizeDiscoveredTool,
  rejectDuplicateToolNames,
} from "@/lib/webmcp/normalize";

type LoadWaiter = {
  promise: Promise<void>;
  resolve: () => void;
};

type TrayTarget = {
  slot: HTMLSpanElement | null;
  restoreButton: HTMLButtonElement | null;
};

function postDocumentHostState(
  frame: HTMLIFrameElement | null,
  origin: string,
  placement: ProviderPlacement,
  presentPace: PresentPace,
) {
  const contentWindow = frame?.contentWindow;
  if (!contentWindow) {
    return;
  }
  contentWindow.postMessage(
    documentVisibilityMessage(placement === "stage"),
    origin,
  );
  contentWindow.postMessage(presentPaceMessage(presentPace), origin);
}

export function RuntimeProvider({
  account,
  directory,
  children,
}: PropsWithChildren<{
  account: Account;
  directory: ProviderDirectory;
}>) {
  const { catalog, getCatalog, preferences } = useProviderLibrary();
  const [state, reactDispatch] = useReducer(
    runtimeReducer,
    account,
    createInitialRuntimeState,
  );
  const [humanPendingIds, setHumanPendingIds] = useState<string[]>([]);
  const waitingOnHuman = humanPendingIds.length > 0;
  const stateRef = useRef(state);
  const dispatch = useCallback((action: RuntimeAction) => {
    stateRef.current = runtimeReducer(stateRef.current, action);
    reactDispatch(action);
  }, []);

  const handlesRef = useRef(new ToolHandleRegistry());
  const executionAbortRef = useRef<AbortController | null>(null);
  const operationLeasesRef = useRef(new Set<string>());
  const instanceAbortsRef = useRef(new Map<string, AbortController>());
  const pendingHumanTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const pendingHumanNotifyRef = useRef<PendingHumanNotification | null>(null);
  const pendingHumanNotifyHost = useMemo(
    () => createBrowserPendingHumanNotifyHost(),
    [],
  );
  const windowSessionsRef = useRef(new Map<string, WindowSession>());
  const pendingFillRef = useRef(new Set<string>());
  const loadWaitersRef = useRef(new Map<string, LoadWaiter>());
  const trayTargetsRef = useRef(new Map<string, TrayTarget>());
  const yellowMinimizeRef = useRef<(providerId: ProviderId) => boolean>(
    () => false,
  );
  const passMinimizeQueue = useRef(
    createPassMinimizeQueue({
      minimize: (providerId) => yellowMinimizeRef.current(providerId),
    }),
  ).current;

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageSlotRef = useRef<HTMLDivElement | null>(null);
  const sessionEnded = state.sessionStatus === "signed-out";

  const onSessionEnded = useCallback(() => {
    dispatch({ type: "session/ended" });
  }, []);

  const waitForLoad = useCallback((instanceId: string) => {
    const existing = loadWaitersRef.current.get(instanceId);
    if (existing) {
      return existing.promise;
    }
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    loadWaitersRef.current.set(instanceId, { promise, resolve });
    return promise;
  }, []);

  const onIframeLoad = useCallback((instanceId: string) => {
    handlesRef.current.invalidateInstance(instanceId);
    dispatch({
      type: "handles/invalidate",
      instanceId,
    });
    dispatch({ type: "provider/loaded", instanceId });
    loadWaitersRef.current.get(instanceId)?.resolve();
  }, []);

  const closeProvider = useCallback((instanceId: string) => {
    handlesRef.current.invalidateInstance(instanceId);
    loadWaitersRef.current.delete(instanceId);
    dispatch({ type: "provider/unmount", instanceId });
  }, []);

  const openProvider = useCallback(
    (providerId: string, openedBy: ControlOwner = "human") => {
      const current = stateRef.current;
      const entry = getProvider(catalog, providerId);
      const id = providerKey(entry);
      const existing = findProviderWindow(current, id);
      if (
        existing &&
        existing.origin === entry.origin &&
        existing.entryUrl === entry.entryUrl
      ) {
        waitForLoad(existing.instanceId);
        dispatch({
          type: "provider/focus",
          instanceId: existing.instanceId,
          touchedAt: Date.now(),
        });
        return existing.instanceId;
      }
      const replacingId = existing?.instanceId;
      if (replacingId) {
        closeProvider(replacingId);
      }
      if (liveWindowCount(current, replacingId) >= LIVE_PROVIDER_CAP) {
        const victim = pickEvictionVictim(current, replacingId);
        if (victim) {
          closeProvider(victim);
        }
      }
      const instanceId = `${id}_${crypto.randomUUID()}`;
      waitForLoad(instanceId);
      dispatch({
        type: "provider/mount",
        providerId: id,
        instanceId,
        origin: entry.origin,
        entryUrl: entry.entryUrl,
        openedBy,
        touchedAt: Date.now(),
      });
      if (openedBy === "human") {
        dispatch({ type: "placement/appear", instanceId });
      }
      return instanceId;
    },
    [catalog, closeProvider, waitForLoad],
  );

  useEffect(() => {
    for (const windowState of Object.values(state.windows)) {
      if (!hasProvider(catalog, windowState.providerId)) {
        closeProvider(windowState.instanceId);
        continue;
      }
      const provider = getProvider(catalog, windowState.providerId);
      if (
        provider.origin !== windowState.origin ||
        provider.entryUrl !== windowState.entryUrl
      ) {
        openProvider(windowState.providerId, windowState.openedBy);
      }
    }
  }, [catalog, closeProvider, openProvider, state.windows]);

  const runDiscovery = useCallback(
    async (
      providerId: string,
      instanceId: string,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>> => {
      try {
        const entry = getProvider(catalog, providerId);
        const id = providerKey(entry);
        await waitForLoad(instanceId);
        signal.throwIfAborted();
        dispatch({
          type: "provider/discovering",
          instanceId,
        });

        const nativeModelContext = document.modelContext;
        if (!nativeModelContext) {
          dispatch({ type: "webmcp/unavailable" });
          dispatch({
            type: "provider/failed",
            instanceId,
            reason: "webmcp_unavailable",
          });
          return boundedError(
            "webmcp_unavailable",
            "WebMCP is unavailable in this browser.",
          );
        }
        dispatch({ type: "webmcp/available" });

        const rawTools = await discoverTools({
          modelContext: nativeModelContext,
          origin: entry.origin,
          discovery:
            entry.source === "builtin"
              ? { mode: "builtin", expectedNames: entry.expectedTools }
              : { mode: "custom" },
          signal,
        });
        if (entry.source === "custom") {
          assertProviderToolCapacity(rawTools);
        }
        const normalized = rejectDuplicateToolNames(
          rawTools.map((tool) =>
            normalizeDiscoveredTool({
              providerId: id,
              instanceId,
              expectedOrigin: entry.origin,
              tool,
              enforceCustomSchemaBounds: entry.source === "custom",
            }),
          ),
        );
        handlesRef.current.invalidateInstance(instanceId);
        for (const tool of normalized) {
          handlesRef.current.set(
            instanceId,
            tool.descriptor.origin,
            tool.descriptor.name,
            tool.handle,
          );
        }
        dispatch({
          type: "provider/ready",
          instanceId,
          tools: normalized.map((tool) => tool.descriptor),
        });
        const output: DiscoverCapabilitiesOutput = {
          providerId: id,
          origin: entry.origin,
          contractVersion:
            entry.source === "builtin" ? entry.contractVersion : null,
          tools: normalized.map((tool) => tool.descriptor),
        };
        return boundedSuccess(output);
      } catch (error) {
        if (error instanceof GatewayError) {
          dispatch({
            type: "provider/failed",
            instanceId,
            reason: error.code,
          });
          return boundedError(error.code, error.message);
        }
        const abortCode = abortErrorCode(error, signal);
        if (abortCode) {
          return boundedError(
            abortCode,
            abortErrorMessage(abortCode, "Capability discovery"),
          );
        }
        dispatch({
          type: "provider/failed",
          instanceId,
          reason: "discovery_failed",
        });
        return boundedError(
          "discovery_failed",
          "Capability discovery failed.",
        );
      }
    },
    [catalog, waitForLoad],
  );

  const holdWindowLease = useCallback((instanceId: string) => {
    const release = acquireOperationLease(
      operationLeasesRef.current,
      instanceId,
    );
    if (!release) {
      return null;
    }
    dispatch({ type: "control/set", instanceId, control: "agent" });
    return () => {
      dispatch({ type: "control/set", instanceId, control: "human" });
      release();
    };
  }, []);

  const takeControl = useCallback((instanceId: string) => {
    abortInstance(
      instanceAbortsRef.current,
      instanceId,
      stoppedByUserAbort(),
    );
  }, []);

  const onHumanPending = useCallback((instanceId: string, open: boolean) => {
    setPendingHumanTimer(
      pendingHumanTimersRef.current,
      instanceId,
      open,
      (id) => {
        abortInstance(instanceAbortsRef.current, id, noResponseAbort());
      },
      PENDING_HUMAN_TIMEOUT_MS,
    );
    setHumanPendingIds((current) => {
      if (open) {
        if (current.includes(instanceId)) {
          return current;
        }
        return [...current, instanceId];
      }
      return current.filter((id) => id !== instanceId);
    });
    if (!open) {
      return;
    }
    dispatch({
      type: "provider/focus",
      instanceId,
      touchedAt: Date.now(),
    });
  }, []);

  useEffect(() => {
    function sync() {
      const pending = humanPendingIds.length > 0;
      const providerId = waitingProviderIds(
        stateRef.current,
        humanPendingIds,
      )[0];
      let title = "";
      if (providerId) {
        if (hasProvider(catalog, providerId)) {
          title = getProvider(catalog, providerId).label;
        }
      }
      syncPendingHumanNotification(
        pendingHumanNotifyRef,
        {
          pending,
          hidden: document.hidden,
          permitted: pendingHumanNotifyPermitted(preferences.notifyWait),
          title,
        },
        pendingHumanNotifyHost,
      );
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
    };
  }, [
    catalog,
    humanPendingIds,
    pendingHumanNotifyHost,
    preferences.notifyWait,
  ]);

  useEffect(() => {
    return () => {
      pendingHumanNotifyRef.current?.close();
      pendingHumanNotifyRef.current = null;
    };
  }, []);

  const listProviders = useCallback(
    (): BoundedResultEnvelope<ListProvidersOutput> => {
      const output: ListProvidersOutput = {
        providers: catalog.providers.map((provider) =>
          provider.source === "builtin"
            ? {
                providerId: provider.providerId,
                label: provider.label,
                source: "builtin",
                capability: "workflow-ready",
                passTools: [...provider.expectedTools],
              }
            : {
                providerId: provider.id,
                label: provider.label,
                source: "custom",
                capability:
                  provider.grantedTools.length > 0
                    ? "granted-invoke"
                    : "discovery-only",
                grantedTools: provider.grantedTools,
              },
        ),
      };
      return boundedSuccess(output);
    },
    [catalog.providers],
  );

  const discoverCapabilities = useCallback(
    async (
      input: DiscoverCapabilitiesInput,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>> => {
      let instanceId: string;
      try {
        instanceId = openProvider(input.providerId, "agent");
      } catch (error) {
        if (error instanceof GatewayError) {
          return boundedError(error.code, error.message);
        }
        throw error;
      }
      const releaseOperation = holdWindowLease(instanceId);
      if (!releaseOperation) {
        return boundedError(
          "operation_in_progress",
          "Another provider operation is already in progress.",
        );
      }
      try {
        const operationSignal = adoptInstanceAbort(
          instanceAbortsRef.current,
          instanceId,
          signal,
        );
        return await runDiscovery(input.providerId, instanceId, operationSignal);
      } finally {
        dropInstanceAbort(instanceAbortsRef.current, instanceId);
        releaseOperation();
      }
    },
    [holdWindowLease, openProvider, runDiscovery],
  );

  const testProvider = useCallback(
    (providerId: string) =>
      discoverCapabilities({ providerId }, new AbortController().signal),
    [discoverCapabilities],
  );

  const invokeGrantedTool = useCallback(
    async (
      input: InvokeGrantedToolInput,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope<InvokeGrantedToolOutput>> => {
      return runGrantedTool({
        input,
        signal,
        dependencies: {
          getCatalog,
          acquireOperation: () => {
            const instanceId = openProvider(input.providerId, "agent");
            const releaseLease = holdWindowLease(instanceId);
            if (!releaseLease) {
              return null;
            }
            return {
              instanceId,
              release: () => {
                dropInstanceAbort(instanceAbortsRef.current, instanceId);
                releaseLease();
              },
            };
          },
          adoptAbort: (instanceId, parent) =>
            adoptInstanceAbort(instanceAbortsRef.current, instanceId, parent),
          getState: () => stateRef.current,
          discover: (providerId, instanceId, operationSignal) =>
            runDiscovery(providerId, instanceId, operationSignal),
          getHandle: (instanceId, origin, toolName) =>
            handlesRef.current.get(instanceId, origin, toolName),
          getModelContext: () => document.modelContext,
        },
      });
    },
    [getCatalog, holdWindowLease, openProvider, runDiscovery],
  );

  const prepareWorkflow = useCallback((
    input: PrepareWorkflowInput,
  ): BoundedResultEnvelope<PrepareWorkflowOutput> => {
    const workflowId = `wf_${crypto.randomUUID()}`;
    const prepared = bindWorkflow({
      state: stateRef.current,
      steps: input.steps,
      workflowId,
      origins: {
        shop: getBuiltinProvider(directory, "shop").origin,
        accounts: getBuiltinProvider(directory, "accounts").origin,
        support: getBuiltinProvider(directory, "support").origin,
      },
    });
    if (!prepared.ok) {
      return prepared.error;
    }
    dispatch({
      type: "workflow/prepared",
      workflowId: prepared.workflowId,
      steps: prepared.steps,
    });
    const output: PrepareWorkflowOutput = {
      workflowId: prepared.workflowId,
      steps: prepared.steps,
    };
    return boundedSuccess(output);
  }, [directory]);

  const executeWorkflow = useCallback(
    async (
      input: ExecuteWorkflowInput,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope<ExecuteWorkflowOutput>> => {
      const combined = new AbortController();
      const onAbort = () => combined.abort(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      executionAbortRef.current = combined;
      try {
        const result = await executePass({
          input,
          signal: combined.signal,
          dependencies: {
            getState: () => stateRef.current,
            dispatch,
            acquireOperation: (providerId) => {
              const instanceId = openProvider(providerId, "agent");
              const releaseLease = holdWindowLease(instanceId);
              if (!releaseLease) {
                return null;
              }
              const instanceSignal = adoptInstanceAbort(
                instanceAbortsRef.current,
                instanceId,
                combined.signal,
              );
              const onInstanceAbort = () => {
                if (!combined.signal.aborted) {
                  combined.abort(instanceSignal.reason);
                }
              };
              instanceSignal.addEventListener("abort", onInstanceAbort, {
                once: true,
              });
              return {
                instanceId,
                release: () => {
                  instanceSignal.removeEventListener("abort", onInstanceAbort);
                  dropInstanceAbort(instanceAbortsRef.current, instanceId);
                  releaseLease();
                },
              };
            },
            discover: (providerId, instanceId, operationSignal) =>
              runDiscovery(providerId, instanceId, operationSignal),
            getHandle: (instanceId, origin, toolName) =>
              handlesRef.current.get(instanceId, origin, toolName),
            getModelContext: () => document.modelContext,
          },
        });
        // if (result.status === "success") {
        //   passMinimizeQueue.enqueue(
        //     usedWindowsToMinimize(
        //       stateRef.current.workflow.steps,
        //       (providerId) =>
        //         findProviderWindow(stateRef.current, providerId)?.placement,
        //     ),
        //   );
        // }
        return result;
      } finally {
        signal.removeEventListener("abort", onAbort);
        executionAbortRef.current = null;
      }
    },
    [holdWindowLease, openProvider, runDiscovery],
  );

  const cancelWorkflow = useCallback(
    (input: CancelWorkflowInput): BoundedResultEnvelope<CancelWorkflowOutput> => {
      const current = stateRef.current;
      if (current.workflow.id !== input.workflowId) {
        return boundedError(
          "workflow_not_found",
          "That workflow is not current.",
        );
      }
      executionAbortRef.current?.abort(
        new DOMException("Workflow cancelled", "AbortError"),
      );
      if (current.workflow.lifecycle === "prepared") {
        dispatch({ type: "workflow/cancelled", workflowId: input.workflowId });
      }
      return boundedSuccess({ workflowId: input.workflowId });
    },
    [],
  );

  const inspectWorkflow = useCallback(
    (
      input: InspectWorkflowInput,
    ): InspectWorkflowOutput | BoundedError => {
      const current = stateRef.current;
      if (current.workflow.id !== input.workflowId) {
        return boundedError(
          "workflow_not_found",
          "That workflow is not current.",
        );
      }
      const output: InspectWorkflowOutput = {
        workflowId: input.workflowId,
        lifecycle: current.workflow.lifecycle,
        steps: current.workflow.steps,
        step: current.workflow.step,
        results: current.workflow.results,
        evidence: current.workflow.evidence,
        failureReason: current.workflow.failureReason,
      };
      return output;
    },
    [],
  );

  const registerTrayTarget = useCallback(
    (
      providerId: string,
      slot: HTMLSpanElement | null,
      restoreButton: HTMLButtonElement | null,
    ) => {
      if (!slot && !restoreButton) {
        trayTargetsRef.current.delete(providerId);
        return;
      }
      trayTargetsRef.current.set(providerId, { slot, restoreButton });
    },
    [],
  );
  const getTrayTarget = useCallback(
    (providerId: string) => trayTargetsRef.current.get(providerId),
    [],
  );

  const activateProvider = useCallback(
    (providerId: string) => {
      const current = stateRef.current;
      const existing = findProviderWindow(current, providerId);
      if (existing) {
        dispatch({
          type: "provider/focus",
          instanceId: existing.instanceId,
          touchedAt: Date.now(),
        });
        if (existing.placement === "tray") {
          dispatch({
            type: "placement/request",
            instanceId: existing.instanceId,
            placement: "stage",
          });
        }
        return;
      }
      openProvider(providerId, "human");
    },
    [openProvider],
  );
  const focusProvider = useCallback((instanceId: string) => {
    dispatch({
      type: "provider/focus",
      instanceId,
      touchedAt: Date.now(),
    });
  }, []);
  const requestPlacement = useCallback(
    (
      instanceId: string,
      placement: ProviderPlacement,
      settle?: "unmount",
      instant?: true,
    ) => {
      dispatch({
        type: "placement/request",
        instanceId,
        placement,
        settle,
        ...(instant ? { instant: true } : {}),
      });
    },
    [],
  );
  const commitPlacement = useCallback((instanceId: string) => {
    const motion = stateRef.current.motion;
    if (
      motion.status === "suction" &&
      motion.instanceId === instanceId &&
      motion.settle === "unmount"
    ) {
      handlesRef.current.invalidateInstance(instanceId);
      loadWaitersRef.current.delete(instanceId);
    }
    dispatch({ type: "motion/finish", instanceId });
  }, []);
  const finishPlacement = useCallback(
    (instanceId: string) => {
      commitPlacement(instanceId);
      passMinimizeQueue.drain();
    },
    [commitPlacement],
  );
  const pourToTray = useCallback(
    (windowState: ProviderWindow): boolean => {
      if (windowState.placement === "tray") {
        return false;
      }
      if (stateRef.current.motion.status === "suction") {
        return true;
      }
      requestPlacement(windowState.instanceId, "tray", undefined, true);
      return false;
    },
    [requestPlacement],
  );
  const cancelPlacement = useCallback((instanceId: string) => {
    dispatch({ type: "motion/cancel", instanceId });
  }, []);
  const bindWindowSession = useCallback(
    (instanceId: string, session: WindowSession) => {
      windowSessionsRef.current.set(instanceId, session);
    },
    [],
  );
  const unbindWindowSession = useCallback((instanceId: string) => {
    windowSessionsRef.current.delete(instanceId);
    pendingFillRef.current.delete(instanceId);
  }, []);
  const takePendingFill = useCallback((instanceId: string) => {
    return pendingFillRef.current.delete(instanceId);
  }, []);

  const minimizeWindow = useCallback(
    (
      input: WindowChromeInput,
    ): BoundedResultEnvelope<WindowChromeOutput> => {
      const resolved = resolveOpenWindow(
        catalog,
        stateRef.current,
        input.providerId,
      );
      if ("status" in resolved) {
        return resolved;
      }
      pourToTray(resolved);
      return boundedSuccess({ providerId: resolved.providerId });
    },
    [catalog, pourToTray],
  );
  yellowMinimizeRef.current = (providerId) => {
    const resolved = resolveOpenWindow(
      catalog,
      stateRef.current,
      providerId,
    );
    if ("status" in resolved) {
      return false;
    }
    return pourToTray(resolved);
  };

  const maximizeWindow = useCallback(
    (
      input: WindowChromeInput,
    ): BoundedResultEnvelope<WindowChromeOutput> => {
      const resolved = resolveOpenWindow(
        catalog,
        stateRef.current,
        input.providerId,
      );
      if ("status" in resolved) {
        return resolved;
      }
      const session = windowSessionsRef.current.get(resolved.instanceId);
      if (!session?.isMaximized()) {
        if (resolved.placement === "tray") {
          pendingFillRef.current.add(resolved.instanceId);
          requestPlacement(resolved.instanceId, "stage", undefined, true);
        } else {
          session?.fillWorkArea();
        }
      }
      return boundedSuccess({ providerId: resolved.providerId });
    },
    [catalog, requestPlacement],
  );

  const closeWindow = useCallback(
    (
      input: WindowChromeInput,
    ): BoundedResultEnvelope<WindowChromeOutput> => {
      const resolved = resolveOpenWindow(
        catalog,
        stateRef.current,
        input.providerId,
      );
      if ("status" in resolved) {
        return resolved;
      }
      closeProvider(resolved.instanceId);
      return boundedSuccess({ providerId: resolved.providerId });
    },
    [catalog, closeProvider],
  );

  const api = useMemo<RuntimeApi>(
    () => ({
      state,
      dispatch,
      directory,
      account,
      workspaceRef,
      stageSlotRef,
      openProvider,
      activateProvider,
      closeProvider,
      registerTrayTarget,
      testProvider,
      waitingOnHuman,
      waitingInstanceIds: humanPendingIds,
    }),
    [
      account,
      directory,
      openProvider,
      activateProvider,
      closeProvider,
      registerTrayTarget,
      testProvider,
      state,
      waitingOnHuman,
      humanPendingIds,
    ],
  );

  return (
    <RuntimeContextProvider value={api}>
      <PlacementMotionDebug />
      <div ref={workspaceRef} className="desktop-canvas relative flex h-dvh flex-col overflow-hidden">
        <div
          inert={sessionEnded ? true : undefined}
          className="relative h-full min-h-0 w-full flex-1"
        >
          {children}
          {Object.values(state.windows).map((windowState) => {
            const stackIndex = state.windowOrder.indexOf(
              windowState.instanceId,
            );
            return stackIndex >= 0 ? (
              <ProviderWindowHost
                key={windowState.instanceId}
                windowState={windowState}
                catalog={catalog}
                workspaceRef={workspaceRef}
                stageSlotRef={stageSlotRef}
                getTrayTarget={getTrayTarget}
                motion={state.motion}
                stackIndex={10 + stackIndex}
                onLoad={onIframeLoad}
                onFocus={focusProvider}
                onPlacement={requestPlacement}
                onMotionFinish={finishPlacement}
                onMotionCancel={cancelPlacement}
                onClose={closeProvider}
                onTakeControl={takeControl}
                onHumanPending={onHumanPending}
                onSessionBind={bindWindowSession}
                onSessionUnbind={unbindWindowSession}
                onTakePendingFill={takePendingFill}
                presentPace={preferences.present}
              />
            ) : null;
          })}
        </div>
        <SignedOutState />
      </div>
      <GatewayRegistrar
        listProviders={listProviders}
        discoverCapabilities={discoverCapabilities}
        invokeGrantedTool={invokeGrantedTool}
        prepareWorkflow={prepareWorkflow}
        executeWorkflow={executeWorkflow}
        cancelWorkflow={cancelWorkflow}
        inspectWorkflow={inspectWorkflow}
        minimizeWindow={minimizeWindow}
        maximizeWindow={maximizeWindow}
        closeWindow={closeWindow}
      />
      {!sessionEnded ? (
        <SessionWatcher account={account} onSessionEnded={onSessionEnded} />
      ) : null}
    </RuntimeContextProvider>
  );
}

function ProviderWindowHost({
  windowState,
  catalog,
  workspaceRef,
  stageSlotRef,
  getTrayTarget,
  motion,
  stackIndex,
  onLoad,
  onFocus,
  onPlacement,
  onMotionFinish,
  onMotionCancel,
  onClose,
  onTakeControl,
  onHumanPending,
  onSessionBind,
  onSessionUnbind,
  onTakePendingFill,
  presentPace,
}: {
  windowState: ProviderWindow;
  catalog: ProviderCatalog;
  workspaceRef: RefObject<HTMLDivElement | null>;
  stageSlotRef: RefObject<HTMLDivElement | null>;
  getTrayTarget: (providerId: string) => TrayTarget | undefined;
  motion: RuntimeMotion;
  stackIndex: number;
  onLoad: (instanceId: string) => void;
  onFocus: (instanceId: string) => void;
  onPlacement: (
    instanceId: string,
    placement: ProviderPlacement,
    settle?: "unmount",
  ) => void;
  onMotionFinish: (instanceId: string) => void;
  onMotionCancel: (instanceId: string) => void;
  onClose: (instanceId: string) => void;
  onTakeControl: (instanceId: string) => void;
  onHumanPending: (instanceId: string, open: boolean) => void;
  onSessionBind: (instanceId: string, session: WindowSession) => void;
  onSessionUnbind: (instanceId: string) => void;
  onTakePendingFill: (instanceId: string) => boolean;
  presentPace: PresentPace;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeLoadedRef = useRef(false);
  const [windowSession] = useState(createWindowSession);
  const [coeditOpen, setCoeditOpen] = useState(false);
  if (windowState.control !== "agent" && coeditOpen) {
    setCoeditOpen(false);
  }
  const reduceMotion = useReducedMotion();
  const previousPlacementRef = useRef(windowState.placement);
  const layoutRafRef = useRef(0);
  const provider = getProvider(catalog, windowState.providerId);
  const bindIframe = useCallback((iframe: HTMLIFrameElement | null) => {
    if (iframeRef.current !== iframe) {
      iframeLoadedRef.current = false;
    }
    iframeRef.current = iframe;
  }, []);
  const placementMotion =
    motion.status === "suction" &&
    motion.instanceId === windowState.instanceId
      ? motion
      : null;

  const applyLayout = useCallback(() => {
    const workspace = workspaceRef.current;
    const surface = surfaceRef.current;
    const workArea = stageSlotRef.current;
    if (!workspace || !surface || !workArea) {
      return;
    }
    windowSession.bind({
      window: surface,
      workspace,
      workArea,
      iframe: iframeRef.current,
    });
    if (placementMotion) {
      return;
    }
    clearPlacementPresentation(surface);
    if (windowState.placement === "tray") {
      if (previousPlacementRef.current === "stage") {
        windowSession.snapshotStage();
      }
      surface.style.visibility = "hidden";
      surface.inert = true;
    } else {
      surface.style.visibility = "visible";
      if (previousPlacementRef.current === "tray") {
        windowSession.restoreStage();
      } else if (windowSession.hasFrame()) {
        windowSession.applyCurrent();
      } else {
        windowSession.openStage();
      }
      if (
        onTakePendingFill(windowState.instanceId) &&
        !windowSession.isMaximized()
      ) {
        windowSession.fillWorkArea();
      }
      surface.inert = false;
    }
    previousPlacementRef.current = windowState.placement;
  }, [
    onTakePendingFill,
    placementMotion,
    stageSlotRef,
    windowSession,
    windowState.instanceId,
    windowState.placement,
    workspaceRef,
  ]);

  useIsomorphicLayoutEffect(() => {
    windowSession.setStackIndex(stackIndex);
  }, [stackIndex, windowSession]);

  useIsomorphicLayoutEffect(() => {
    applyLayout();
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (layoutRafRef.current) {
        return;
      }
      layoutRafRef.current = requestAnimationFrame(() => {
        layoutRafRef.current = 0;
        if (placementMotion) {
          return;
        }
        if (windowState.placement === "tray") {
          applyLayout();
        } else {
          windowSession.relayout();
        }
      });
    });
    observer.observe(workspace);
    if (stageSlotRef.current) {
      observer.observe(stageSlotRef.current);
    }
    return () => {
      observer.disconnect();
      if (layoutRafRef.current) {
        cancelAnimationFrame(layoutRafRef.current);
        layoutRafRef.current = 0;
      }
    };
  }, [
    applyLayout,
    placementMotion,
    stageSlotRef,
    windowSession,
    windowState.placement,
    workspaceRef,
  ]);

  useIsomorphicLayoutEffect(() => {
    if (!placementMotion) {
      return;
    }
    if (reduceMotion || windowSession.isMaximized()) {
      onMotionFinish(windowState.instanceId);
      if (
        placementMotion.placement === "stage" &&
        placementMotion.settle !== "unmount"
      ) {
        requestAnimationFrame(() => iframeRef.current?.focus());
      }
      return;
    }
    const surface = surfaceRef.current;
    const workspace = workspaceRef.current;
    const trayTarget = getTrayTarget(windowState.providerId);
    if (!surface || !workspace || !trayTarget?.slot) {
      if (placementMotion.settle === "unmount") {
        onClose(windowState.instanceId);
      } else {
        onMotionCancel(windowState.instanceId);
      }
      return;
    }
    clearPlacementPresentation(surface);
    if (placementMotion.placement === "tray") {
      windowSession.snapshotStage();
    } else {
      windowSession.restoreStage();
    }
    surface.style.visibility = "visible";
    surface.inert = true;
    const workspaceRect = workspace.getBoundingClientRect();
    const source = layoutFromRect(
      workspaceRect,
      surface.getBoundingClientRect(),
    );
    const target = layoutFromRect(
      workspaceRect,
      trayTarget.slot.getBoundingClientRect(),
    );
    const animation = animatePlacement({
      surface,
      source,
      target,
      placement: placementMotion.placement,
      onComplete: () => {
        onMotionFinish(windowState.instanceId);
        if (
          placementMotion.placement === "stage" &&
          placementMotion.settle !== "unmount"
        ) {
          requestAnimationFrame(() => iframeRef.current?.focus());
        }
      },
    });
    return () => {
      animation.stop();
      animation.clear();
    };
  }, [
    getTrayTarget,
    onClose,
    onMotionCancel,
    onMotionFinish,
    placementMotion,
    reduceMotion,
    windowSession,
    windowState.instanceId,
    windowState.providerId,
  ]);

  useIsomorphicLayoutEffect(() => {
    onSessionBind(windowState.instanceId, windowSession);
    return () => onSessionUnbind(windowState.instanceId);
  }, [
    onSessionBind,
    onSessionUnbind,
    windowSession,
    windowState.instanceId,
  ]);

  useEffect(() => () => windowSession.unbind(), [windowSession]);

  useEffect(() => {
    if (!iframeLoadedRef.current) {
      return;
    }
    postDocumentHostState(
      iframeRef.current,
      windowState.origin,
      windowState.placement,
      presentPace,
    );
  }, [presentPace, windowState.origin, windowState.placement]);

  useEffect(() => {
    if (windowState.control !== "agent") {
      onHumanPending(windowState.instanceId, false);
    }
  }, [onHumanPending, windowState.control, windowState.instanceId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const coedit = parseCoeditMessage(
        event.data,
        event.origin,
        windowState.origin,
      );
      if (coedit !== null) {
        setCoeditOpen(coedit);
      }
      const pending = parsePendingHumanMessage(
        event.data,
        event.origin,
        windowState.origin,
      );
      if (pending !== null) {
        onHumanPending(windowState.instanceId, pending);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    onHumanPending,
    windowState.instanceId,
    windowState.origin,
  ]);

  return (
    <AppWindow.Root
      providerId={windowState.providerId}
      instanceId={windowState.instanceId}
      title={provider.label}
      icon={provider.icon}
      placement={placementMotion ? "stage" : windowState.placement}
      suctioning={Boolean(placementMotion)}
      motionTarget={placementMotion?.placement ?? null}
      surfaceRef={surfaceRef}
      windowSession={windowSession}
      onFocus={() => onFocus(windowState.instanceId)}
      onClose={() => {
        if (windowSession.isMaximized()) {
          onClose(windowState.instanceId);
          return;
        }
        onPlacement(windowState.instanceId, "tray", "unmount");
      }}
      onMinimize={() => {
        onPlacement(windowState.instanceId, "tray");
        if (windowSession.isMaximized()) {
          onMotionFinish(windowState.instanceId);
        }
        getTrayTarget(windowState.providerId)?.restoreButton?.focus();
      }}
      leased={windowState.control === "agent"}
      coeditOpen={coeditOpen}
      onTakeControl={() => {
        iframeRef.current?.contentWindow?.postMessage(
          presentationCancelMessage(),
          windowState.origin,
        );
        onTakeControl(windowState.instanceId);
      }}
    >
      <iframe
        ref={bindIframe}
        src={windowState.entryUrl}
        allow="tools"
        title={provider.label}
        className="size-full border-0"
        onFocus={() => onFocus(windowState.instanceId)}
        onLoad={() => {
          iframeLoadedRef.current = true;
          setCoeditOpen(false);
          onHumanPending(windowState.instanceId, false);
          postDocumentHostState(
            iframeRef.current,
            windowState.origin,
            windowState.placement,
            presentPace,
          );
          onLoad(windowState.instanceId);
        }}
      />
    </AppWindow.Root>
  );
}
