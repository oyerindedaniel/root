"use client";

import {
  boundedError,
  boundedSuccess,
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
  type ProviderPlacement,
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
import { createWindowSession } from "@/lib/window/session";
import {
  DirectoryError,
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
import { executePass } from "@/lib/runtime/execute-pass";
import { GatewayRegistrar } from "@/lib/runtime/gateway-registrar";
import { invokeGrantedTool as runGrantedTool } from "@/lib/runtime/invoke-granted";
import { isCancellation } from "@/lib/runtime/cancellation";
import { acquireOperationLease } from "@/lib/runtime/operation-lease";
import { prepareWorkflow as bindWorkflow } from "@/lib/runtime/prepare";
import { runtimeReducer } from "@/lib/runtime/reducer";
import {
  RuntimeContextProvider,
  type RuntimeApi,
} from "@/lib/runtime/runtime-context";
import { SessionWatcher } from "@/lib/runtime/session-watcher";
import {
  createInitialRuntimeState,
  findProviderWindow,
  type ControlOwner,
  type ProviderWindow,
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

export function RuntimeProvider({
  account,
  directory,
  children,
}: PropsWithChildren<{
  account: Account;
  directory: ProviderDirectory;
}>) {
  const { catalog } = useProviderLibrary();
  const [state, dispatch] = useReducer(
    runtimeReducer,
    account,
    createInitialRuntimeState,
  );
  const stateRef = useRef(state);

  useIsomorphicLayoutEffect(() => {
    stateRef.current = state;
  });

  const handlesRef = useRef(new ToolHandleRegistry());
  const executionAbortRef = useRef<AbortController | null>(null);
  const operationLeasesRef = useRef(new Set<string>());
  const loadWaitersRef = useRef(new Map<string, LoadWaiter>());
  const trayTargetsRef = useRef(new Map<string, TrayTarget>());

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
        dispatch({
          type: "provider/focus",
          instanceId: existing.instanceId,
          touchedAt: Date.now(),
        });
        return existing.instanceId;
      }
      if (existing) {
        handlesRef.current.invalidateInstance(existing.instanceId);
        loadWaitersRef.current.delete(existing.instanceId);
        dispatch({ type: "provider/unmount", instanceId: existing.instanceId });
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
      dispatch({ type: "placement/appear", instanceId });
      return instanceId;
    },
    [catalog, waitForLoad],
  );

  const closeProvider = useCallback((instanceId: string) => {
    handlesRef.current.invalidateInstance(instanceId);
    loadWaitersRef.current.delete(instanceId);
    dispatch({ type: "provider/unmount", instanceId });
  }, []);

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
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>> => {
      let instanceId: string | undefined;
      try {
        const entry = getProvider(catalog, providerId);
        const id = providerKey(entry);
        const openedInstanceId = openProvider(providerId, "agent");
        instanceId = openedInstanceId;
        await waitForLoad(openedInstanceId);
        signal.throwIfAborted();
        dispatch({
          type: "provider/discovering",
          instanceId: openedInstanceId,
        });

        const modelContext = document.modelContext;
        if (!modelContext) {
          dispatch({ type: "webmcp/unavailable" });
          dispatch({
            type: "provider/failed",
            instanceId: openedInstanceId,
            reason: "webmcp_unavailable",
          });
          return boundedError(
            "webmcp_unavailable",
            "WebMCP is unavailable in this browser.",
          );
        }
        dispatch({ type: "webmcp/available" });

        const rawTools = await discoverTools({
          modelContext,
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
              instanceId: openedInstanceId,
              expectedOrigin: entry.origin,
              tool,
              enforceCustomSchemaBounds: entry.source === "custom",
            }),
          ),
        );
        handlesRef.current.invalidateInstance(openedInstanceId);
        for (const tool of normalized) {
          handlesRef.current.set(
            openedInstanceId,
            tool.descriptor.origin,
            tool.descriptor.name,
            tool.handle,
          );
        }
        dispatch({
          type: "provider/ready",
          instanceId: openedInstanceId,
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
        if (error instanceof DirectoryError) {
          if (instanceId) {
            dispatch({
              type: "provider/failed",
              instanceId,
              reason: error.code,
            });
          }
          return boundedError(error.code, error.message);
        }
        const code =
          isCancellation(error, signal)
            ? "cancelled"
            : error instanceof Error && error.name === "DiscoveryTimeoutError"
              ? "discovery_timeout"
              : error instanceof Error &&
                  (error.message === "schema_too_large" ||
                    error.message === "invalid_schema" ||
                    error.message === "provider_tool_limit")
                ? error.message
                : error instanceof Error && error.message === "invalid_json"
                  ? "invalid_schema"
                : "discovery_failed";
        if (instanceId) {
          dispatch({ type: "provider/failed", instanceId, reason: code });
        }
        return boundedError(code, "Capability discovery failed.");
      }
    },
    [catalog, openProvider, waitForLoad],
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
        if (error instanceof DirectoryError) {
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
        return await runDiscovery(input.providerId, signal);
      } finally {
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
          catalog,
          acquireOperation: () => {
            const instanceId = openProvider(input.providerId, "agent");
            return holdWindowLease(instanceId);
          },
          getState: () => stateRef.current,
          discover: (providerId, operationSignal) =>
            runDiscovery(providerId, operationSignal),
          getHandle: (instanceId, origin, toolName) =>
            handlesRef.current.get(instanceId, origin, toolName),
          getModelContext: () => document.modelContext,
        },
      });
    },
    [catalog, holdWindowLease, openProvider, runDiscovery],
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
      const onAbort = () => combined.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      executionAbortRef.current = combined;
      try {
        return await executePass({
          input,
          signal: combined.signal,
          dependencies: {
            getState: () => stateRef.current,
            dispatch,
            acquireOperation: (providerId) => {
              const instanceId = openProvider(providerId, "agent");
              return holdWindowLease(instanceId);
            },
            discover: (providerId, operationSignal) =>
              runDiscovery(providerId, operationSignal),
            getHandle: (instanceId, origin, toolName) =>
              handlesRef.current.get(instanceId, origin, toolName),
            getModelContext: () => document.modelContext,
          },
        });
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
    ) => {
      dispatch({ type: "placement/request", instanceId, placement, settle });
    },
    [],
  );
  const finishPlacement = useCallback((instanceId: string) => {
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
  const cancelPlacement = useCallback((instanceId: string) => {
    dispatch({ type: "motion/cancel", instanceId });
  }, []);

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
      registerTrayTarget,
      testProvider,
    }),
    [
      account,
      directory,
      openProvider,
      activateProvider,
      registerTrayTarget,
      testProvider,
      state,
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
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [windowSession] = useState(createWindowSession);
  const reduceMotion = useReducedMotion();
  const previousPlacementRef = useRef(windowState.placement);
  const layoutRafRef = useRef(0);
  const provider = getProvider(catalog, windowState.providerId);
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
      surface.inert = false;
    }
    previousPlacementRef.current = windowState.placement;
  }, [
    placementMotion,
    stageSlotRef,
    windowSession,
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

  useEffect(() => () => windowSession.unbind(), [windowSession]);

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
    >
      <iframe
        ref={iframeRef}
        src={windowState.entryUrl}
        allow="tools"
        title={provider.label}
        className="size-full border-0"
        onFocus={() => onFocus(windowState.instanceId)}
        onLoad={() => onLoad(windowState.instanceId)}
      />
    </AppWindow.Root>
  );
}
