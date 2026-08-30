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
} from "@repo/contracts";
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
import { SignedOutState } from "@/components/workspace/signed-out-state";
import { applyFrame, layoutFromRect } from "@/lib/window/frame";
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
  type RuntimeState,
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
  instanceId: string;
  promise: Promise<void>;
  resolve: () => void;
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
  const agentOperationRef = useRef(false);
  const motionAbortRef = useRef<AbortController | null>(null);
  const loadWaiterRef = useRef<LoadWaiter | null>(null);

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageSlotRef = useRef<HTMLDivElement | null>(null);
  const traySlotRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const restoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const [windowSession] = useState(createWindowSession);
  const layoutRafRef = useRef(0);
  const sessionEnded = state.sessionStatus === "signed-out";

  const onSessionEnded = useCallback(() => {
    dispatch({ type: "session/ended" });
  }, []);

  const waitForLoad = useCallback((instanceId: string) => {
    const existing = loadWaiterRef.current;
    if (existing?.instanceId === instanceId) {
      return existing.promise;
    }
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    loadWaiterRef.current = { instanceId, promise, resolve };
    return promise;
  }, []);

  const onIframeLoad = useCallback(() => {
    const current = stateRef.current;
    if (!current.provider.instanceId) {
      return;
    }
    handlesRef.current.invalidateInstance(current.provider.instanceId);
    dispatch({
      type: "handles/invalidate",
      instanceId: current.provider.instanceId,
    });
    dispatch({ type: "provider/loaded", instanceId: current.provider.instanceId });
    loadWaiterRef.current?.resolve();
  }, []);

  const openProvider = useCallback(
    (providerId: string, forceRemount = false) => {
      const current = stateRef.current;
      if (
        !forceRemount &&
        current.provider.instanceId &&
        current.provider.providerId === providerId
      ) {
        return current.provider.instanceId;
      }
      if (current.provider.instanceId) {
        motionAbortRef.current?.abort();
        windowSession.unbind();
        handlesRef.current.invalidateInstance(current.provider.instanceId);
      }
      const entry = getProvider(catalog, providerId);
      const id = providerKey(entry);
      const instanceId = `${id}_${crypto.randomUUID()}`;
      dispatch({
        type: "provider/mount",
        providerId: id,
        instanceId,
        origin: entry.origin,
        entryUrl: entry.entryUrl,
      });
      return instanceId;
    },
    [catalog, windowSession],
  );

  const unmountProvider = useCallback(() => {
    motionAbortRef.current?.abort();
    windowSession.unbind();
    const instanceId = stateRef.current.provider.instanceId;
    if (instanceId) {
      handlesRef.current.invalidateInstance(instanceId);
      dispatch({ type: "handles/invalidate", instanceId });
    }
    dispatch({ type: "provider/unmount" });
  }, [windowSession]);

  const closeProvider = useCallback(() => {
    unmountProvider();
  }, [unmountProvider]);

  useEffect(() => {
    const providerId = state.provider.providerId;
    if (providerId && !hasProvider(catalog, providerId)) {
      unmountProvider();
    }
  }, [catalog, state.provider.providerId, unmountProvider]);

  const runDiscovery = useCallback(
    async (
      providerId: string,
      signal: AbortSignal,
      forceRemount = false,
    ): Promise<BoundedResultEnvelope<DiscoverCapabilitiesOutput>> => {
      try {
        const entry = getProvider(catalog, providerId);
        const id = providerKey(entry);
        const instanceId = openProvider(providerId, forceRemount);
        await waitForLoad(instanceId);
        signal.throwIfAborted();
        dispatch({ type: "provider/discovering", instanceId });

        const modelContext = document.modelContext;
        if (!modelContext) {
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
        if (error instanceof DirectoryError) {
          dispatch({ type: "provider/failed", reason: error.code });
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
        dispatch({ type: "provider/failed", reason: code });
        return boundedError(code, "Capability discovery failed.");
      }
    },
    [catalog, openProvider, waitForLoad],
  );

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
      const releaseOperation = acquireOperationLease(agentOperationRef);
      if (!releaseOperation) {
        return boundedError(
          "operation_in_progress",
          "Another provider operation is already in progress.",
        );
      }
      dispatch({ type: "control/set", control: "agent" });
      try {
        return await runDiscovery(input.providerId, signal);
      } finally {
        dispatch({ type: "control/set", control: "human" });
        releaseOperation();
      }
    },
    [runDiscovery],
  );

  const testProvider = useCallback(
    (providerId: string) =>
      runDiscovery(providerId, new AbortController().signal),
    [runDiscovery],
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
            const release = acquireOperationLease(agentOperationRef);
            if (!release) {
              return null;
            }
            dispatch({ type: "control/set", control: "agent" });
            return () => {
              dispatch({ type: "control/set", control: "human" });
              release();
            };
          },
          getState: () => stateRef.current,
          discover: (providerId, operationSignal) =>
            runDiscovery(providerId, operationSignal, true),
          getHandle: (instanceId, origin, toolName) =>
            handlesRef.current.get(instanceId, origin, toolName),
          getModelContext: () => document.modelContext,
        },
      });
    },
    [catalog, runDiscovery],
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
      const releaseOperation = acquireOperationLease(agentOperationRef);
      if (!releaseOperation) {
        return boundedError(
          "operation_in_progress",
          "Another provider operation is already in progress.",
        );
      }

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
            discover: (providerId, operationSignal) =>
              runDiscovery(providerId, operationSignal, true),
            getHandle: (instanceId, origin, toolName) =>
              handlesRef.current.get(instanceId, origin, toolName),
            getModelContext: () => document.modelContext,
          },
        });
      } finally {
        signal.removeEventListener("abort", onAbort);
        executionAbortRef.current = null;
        releaseOperation();
      }
    },
    [runDiscovery],
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

  const applySurfaceLayout = useCallback((placement: "stage" | "tray") => {
    const workspace = workspaceRef.current;
    const surface = surfaceRef.current;
    const workArea = stageSlotRef.current;
    const tray = traySlotRef.current;
    const session = windowSession;
    if (!workspace || !surface || !workArea) {
      return;
    }
    session.bind({
      window: surface,
      workspace,
      workArea,
      iframe: iframeRef.current,
    });
    if (placement === "tray") {
      if (!tray) {
        return;
      }
      applyFrame(surface, layoutFromRect(
        workspace.getBoundingClientRect(),
        tray.getBoundingClientRect(),
      ));
      surface.inert = true;
      return;
    }
    if (session.hasFrame()) {
      session.applyCurrent();
    } else {
      session.openStage();
    }
    surface.inert = false;
  }, [windowSession]);

  const requestPlacement = useCallback(
    (placement: "stage" | "tray") => {
      const current = stateRef.current;
      if (
        current.motion === "suction" ||
        current.provider.lifecycle === "unmounted" ||
        current.provider.placement === placement
      ) {
        return;
      }
      const surface = surfaceRef.current;
      const workspace = workspaceRef.current;
      const destination =
        placement === "stage" ? stageSlotRef.current : traySlotRef.current;
      if (!surface || !workspace || !destination) {
        return;
      }
      if (placement === "tray") {
        windowSession.snapshotStage();
      }
      if (placement === "stage") {
        windowSession.restoreStage();
      } else {
        applySurfaceLayout("tray");
      }
      surface.inert = placement === "tray";
      dispatch({ type: "motion/finish", placement });
      if (placement === "tray") {
        restoreButtonRef.current?.focus();
      } else {
        stageSlotRef.current?.focus();
      }
    },
    [applySurfaceLayout, windowSession],
  );

  const activateProvider = useCallback(
    (providerId: string) => {
      const current = stateRef.current;
      if (
        current.provider.providerId === providerId &&
        current.provider.lifecycle !== "unmounted"
      ) {
        if (current.provider.placement === "tray") {
          requestPlacement("stage");
        }
        return;
      }
      openProvider(providerId);
    },
    [openProvider, requestPlacement],
  );

  useIsomorphicLayoutEffect(() => {
    if (state.provider.lifecycle === "unmounted") {
      windowSession.unbind();
      return;
    }
    applySurfaceLayout(state.provider.placement);
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
        const current = stateRef.current;
        if (
          current.motion === "suction" ||
          current.provider.lifecycle === "unmounted"
        ) {
          return;
        }
        if (current.provider.placement === "tray") {
          applySurfaceLayout("tray");
          return;
        }
        windowSession.relayout();
      });
    });
    observer.observe(workspace);
    const workArea = stageSlotRef.current;
    if (workArea) {
      observer.observe(workArea);
    }
    if (
      state.provider.placement === "stage" &&
      !windowSession.hasFrame()
    ) {
      requestAnimationFrame(() => {
        windowSession.openStage();
      });
    }
    return () => {
      observer.disconnect();
      if (layoutRafRef.current) {
        cancelAnimationFrame(layoutRafRef.current);
        layoutRafRef.current = 0;
      }
    };
  }, [
    applySurfaceLayout,
    state.provider.lifecycle,
    state.provider.placement,
    windowSession,
  ]);

  const api = useMemo<RuntimeApi>(
    () => ({
      state,
      dispatch,
      directory,
      account,
      workspaceRef,
      stageSlotRef,
      traySlotRef,
      surfaceRef,
      iframeRef,
      restoreButtonRef,
      requestPlacement,
      openProvider,
      closeProvider,
      activateProvider,
      testProvider,
      windowSession
    }),
    [
      account,
      directory,
      openProvider,
      closeProvider,
      activateProvider,
      testProvider,
      requestPlacement,
      state,
      windowSession,
    ],
  );

  return (
    <RuntimeContextProvider value={api}>
      <div ref={workspaceRef} className="desktop-canvas relative flex h-dvh flex-col overflow-hidden">
        <div
          inert={sessionEnded ? true : undefined}
          className="relative h-full min-h-0 w-full flex-1"
        >
          {children}
          <ProviderIframe
            state={state}
            catalog={catalog}
            iframeRef={iframeRef}
            onLoad={onIframeLoad}
          />
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

function ProviderIframe({
  state,
  catalog,
  iframeRef,
  onLoad,
}: {
  state: RuntimeState;
  catalog: ProviderCatalog;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  onLoad: () => void;
}) {
  if (
    state.provider.lifecycle === "unmounted" ||
    !state.provider.entryUrl ||
    !state.provider.providerId
  ) {
    return null;
  }

  const provider = getProvider(catalog, state.provider.providerId);

  return (
    <AppWindow.Root
      key={state.provider.instanceId}
      title={provider.label}
      icon={provider.icon}
    >
      <iframe
        ref={iframeRef}
        src={state.provider.entryUrl}
        allow="tools"
        title={provider.label}
        className="size-full border-0"
        onLoad={onLoad}
      />
    </AppWindow.Root>
  );
}
