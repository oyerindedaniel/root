"use client";

import {
  boundedError,
  parseBoundedJsonResult,
  parseExecuteResultText,
  type Account,
  type BoundedResultEnvelope,
  type DiscoverCapabilitiesInput,
  type InspectWorkflowOutput,
} from "@repo/contracts";
import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { AppWindow } from "@/components/workspace/app-window";
import { applyFrame, layoutFromRect } from "@/lib/window/frame";
import { createWindowSession } from "@/lib/window/session";
import {
  DirectoryError,
  getTrustedProvider,
  pinForProvider,
  type ProviderDirectory,
} from "@/lib/providers/directory";
import { GatewayRegistrar } from "@/lib/runtime/gateway-registrar";
import { getPassReadTool } from "@/lib/runtime/pass-tools";
import { prepareWorkflow as bindWorkflow, revalidatePreparedStep } from "@/lib/runtime/prepare";
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
import { executeRegisteredTool } from "@/lib/webmcp/execute";
import { ToolHandleRegistry } from "@/lib/webmcp/handles";
import {
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
  const motionAbortRef = useRef<AbortController | null>(null);
  const loadWaiterRef = useRef<LoadWaiter | null>(null);

  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageSlotRef = useRef<HTMLDivElement | null>(null);
  const traySlotRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const restoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const windowSessionRef = useRef(createWindowSession());
  const layoutRafRef = useRef(0);

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
    (providerId: string) => {
      const current = stateRef.current;
      if (
        current.provider.instanceId &&
        current.provider.providerId === providerId
      ) {
        return current.provider.instanceId;
      }
      if (current.provider.instanceId) {
        motionAbortRef.current?.abort();
        windowSessionRef.current.unbind();
        handlesRef.current.invalidateInstance(current.provider.instanceId);
      }
      const entry = getTrustedProvider(directory, providerId);
      const instanceId = `${entry.providerId}_${crypto.randomUUID()}`;
      dispatch({
        type: "provider/mount",
        providerId: entry.providerId,
        instanceId,
        origin: entry.origin,
        entryUrl: entry.entryUrl,
      });
      return instanceId;
    },
    [directory],
  );

  const closeProvider = useCallback(() => {
    motionAbortRef.current?.abort();
    windowSessionRef.current.unbind();
    dispatch({ type: "provider/unmount" });
  }, []);

  const runDiscovery = useCallback(
    async (
      providerId: string,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope> => {
      try {
        const entry = getTrustedProvider(directory, providerId);
        const instanceId = openProvider(providerId);
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
          expectedNames: entry.expectedTools,
          signal,
        });
        const normalized = rejectDuplicateToolNames(
          rawTools.map((tool) =>
            normalizeDiscoveredTool({
              providerId: entry.providerId,
              instanceId,
              expectedOrigin: entry.origin,
              tool,
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
        return {
          status: "success",
          data: {
            providerId: entry.providerId,
            origin: entry.origin,
            contractVersion: entry.contractVersion,
            tools: normalized.map((tool) => tool.descriptor),
          },
        };
      } catch (error) {
        if (error instanceof DirectoryError) {
          dispatch({ type: "provider/failed", reason: error.code });
          return boundedError(error.code, error.message);
        }
        const cancelled =
          signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError");
        const code = cancelled
          ? "cancelled"
          : error instanceof Error && error.name === "DiscoveryTimeoutError"
            ? "discovery_timeout"
            : "discovery_failed";
        dispatch({ type: "provider/failed", reason: code });
        return boundedError(code, "Capability discovery failed.");
      }
    },
    [directory, openProvider, waitForLoad],
  );

  const discoverCapabilities = useCallback(
    async (
      input: DiscoverCapabilitiesInput,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope> => {
      dispatch({ type: "control/set", control: "agent" });
      try {
        return await runDiscovery(input.providerId, signal);
      } finally {
        dispatch({ type: "control/set", control: "human" });
      }
    },
    [runDiscovery],
  );

  const prepareWorkflow = useCallback((input: unknown): BoundedResultEnvelope => {
    const parsed = (input as { steps?: unknown[] }) ?? {};
    const workflowId = `wf_${crypto.randomUUID()}`;
    const prepared = bindWorkflow({
      state: stateRef.current,
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      workflowId,
      origins: {
        shop: directory.providers.shop.origin,
        accounts: directory.providers.accounts.origin,
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
    return {
      status: "success",
      data: {
        workflowId: prepared.workflowId,
        steps: prepared.steps,
      },
    };
  }, [directory]);

  const executeWorkflow = useCallback(
    async (
      input: { workflowId: string },
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope> => {
      const current = stateRef.current;
      if (
        current.workflow.id !== input.workflowId ||
        current.workflow.lifecycle !== "prepared" ||
        current.workflow.steps.length === 0
      ) {
        return boundedError(
          "workflow_not_prepared",
          "No prepared workflow matches that id.",
        );
      }
      const steps = current.workflow.steps;

      const combined = new AbortController();
      const onAbort = () => combined.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      executionAbortRef.current = combined;

      dispatch({ type: "workflow/executing", workflowId: input.workflowId });
      const results: unknown[] = [];
      const evidenceParts: string[] = [];
      try {
        for (let index = 0; index < steps.length; index += 1) {
          const step = steps[index];
          if (!step) {
            throw new Error("execution_failed");
          }
          dispatch({
            type: "workflow/step",
            workflowId: input.workflowId,
            index,
          });
          const discovered = await runDiscovery(
            step.providerId,
            combined.signal,
          );
          if (discovered.status === "error") {
            dispatch({
              type: "workflow/failed",
              workflowId: input.workflowId,
              reason: discovered.code,
            });
            return discovered;
          }
          combined.signal.throwIfAborted();

          const live = stateRef.current;
          const revalidated = revalidatePreparedStep({ state: live, step });
          if (!revalidated.ok) {
            dispatch({ type: "workflow/invalidate" });
            return revalidated.error;
          }
          if (!live.provider.instanceId) {
            dispatch({ type: "workflow/invalidate" });
            return boundedError(
              "revalidation_failed",
              "The provider document is gone.",
            );
          }

          const spec = getPassReadTool(step.namespacedName);
          const handle = handlesRef.current.get(
            live.provider.instanceId,
            step.origin,
            step.toolName,
          );
          const descriptor = live.discoveredTools.find(
            (tool) =>
              tool.providerId === step.providerId &&
              tool.name === step.toolName,
          );
          if (!spec || !handle || !descriptor) {
            dispatch({ type: "workflow/invalidate" });
            return boundedError(
              "revalidation_failed",
              "The prepared tool is no longer registered.",
            );
          }

          const modelContext = document.modelContext;
          if (!modelContext) {
            dispatch({ type: "webmcp/unavailable" });
            dispatch({
              type: "workflow/failed",
              workflowId: input.workflowId,
              reason: "webmcp_unavailable",
            });
            return boundedError(
              "webmcp_unavailable",
              "WebMCP is unavailable in this browser.",
            );
          }

          dispatch({ type: "workflow/executing", workflowId: input.workflowId });
          const resultText = await executeRegisteredTool({
            modelContext,
            tool: handle,
            invokeKind: descriptor.invokeKind,
            input: step.arguments,
            signal: combined.signal,
          });
          const parsed = spec.parseOutput(
            parseBoundedJsonResult(parseExecuteResultText(resultText)),
          );
          if (!parsed) {
            throw new Error("execution_failed");
          }
          results.push(parsed.data);
          evidenceParts.push(parsed.evidence);
        }

        const evidence = evidenceParts.join("; ");
        dispatch({
          type: "workflow/passed",
          workflowId: input.workflowId,
          result: results.length === 1 ? results[0] : { results },
          results,
          evidence,
        });
        return {
          status: "success",
          data: results.length === 1 ? results[0] : { results },
        };
      } catch (error) {
        const cancelled =
          combined.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError");
        if (cancelled) {
          dispatch({
            type: "workflow/cancelled",
            workflowId: input.workflowId,
          });
          return boundedError("cancelled", "Workflow was cancelled.");
        }
        dispatch({
          type: "workflow/failed",
          workflowId: input.workflowId,
          reason: "execution_failed",
        });
        return boundedError("execution_failed", "Workflow execution failed.");
      } finally {
        signal.removeEventListener("abort", onAbort);
        executionAbortRef.current = null;
      }
    },
    [runDiscovery],
  );

  const cancelWorkflow = useCallback(
    (input: { workflowId: string }): BoundedResultEnvelope => {
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
      return { status: "success", data: { workflowId: input.workflowId } };
    },
    [],
  );

  const inspectWorkflow = useCallback(
    (
      input: { workflowId: string },
    ): InspectWorkflowOutput | BoundedResultEnvelope => {
      const current = stateRef.current;
      if (current.workflow.id !== input.workflowId) {
        return boundedError(
          "workflow_not_found",
          "That workflow is not current.",
        );
      }
      const last =
        current.workflow.results[current.workflow.results.length - 1];
      const result =
        last === undefined
          ? null
          : {
              status: "success" as const,
              data: last,
            };
      return {
        workflowId: input.workflowId,
        lifecycle: current.workflow.lifecycle,
        steps: current.workflow.steps,
        step: current.workflow.step,
        results: current.workflow.results,
        result,
        failureReason: current.workflow.failureReason,
      };
    },
    [],
  );

  const applySurfaceLayout = useCallback((placement: "stage" | "tray") => {
    const workspace = workspaceRef.current;
    const surface = surfaceRef.current;
    const workArea = stageSlotRef.current;
    const tray = traySlotRef.current;
    const session = windowSessionRef.current;
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
  }, []);

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
        windowSessionRef.current.snapshotStage();
      }
      if (placement === "stage") {
        windowSessionRef.current.restoreStage();
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
    [applySurfaceLayout],
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
      windowSessionRef.current.unbind();
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
        windowSessionRef.current.relayout();
      });
    });
    observer.observe(workspace);
    const workArea = stageSlotRef.current;
    if (workArea) {
      observer.observe(workArea);
    }
    if (
      state.provider.placement === "stage" &&
      !windowSessionRef.current.hasFrame()
    ) {
      requestAnimationFrame(() => {
        windowSessionRef.current.openStage();
      });
    }
    return () => {
      observer.disconnect();
      if (layoutRafRef.current) {
        cancelAnimationFrame(layoutRafRef.current);
        layoutRafRef.current = 0;
      }
    };
  }, [applySurfaceLayout, state.provider.lifecycle, state.provider.placement]);

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
      windowSession: windowSessionRef.current,
    }),
    [
      account,
      directory,
      openProvider,
      closeProvider,
      activateProvider,
      requestPlacement,
      state,
    ],
  );

  return (
    <RuntimeContextProvider value={api}>
      <div ref={workspaceRef} className="desktop-canvas relative flex h-dvh flex-col overflow-hidden">
        {children}
        <ProviderIframe
          state={state}
          directory={directory}
          iframeRef={iframeRef}
          onLoad={onIframeLoad}
        />
      </div>
      <GatewayRegistrar
        discoverCapabilities={discoverCapabilities}
        prepareWorkflow={prepareWorkflow}
        executeWorkflow={executeWorkflow}
        cancelWorkflow={cancelWorkflow}
        inspectWorkflow={inspectWorkflow}
      />
      <SessionWatcher
        onSignedOut={() => dispatch({ type: "session/signed-out" })}
      />
    </RuntimeContextProvider>
  );
}

function ProviderIframe({
  state,
  directory,
  iframeRef,
  onLoad,
}: {
  state: RuntimeState;
  directory: ProviderDirectory;
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

  const pin = pinForProvider(directory, state.provider.providerId);

  return (
    <AppWindow.Root key={state.provider.instanceId} title={pin.label} icon={pin.icon}>
      <iframe
        ref={iframeRef}
        src={state.provider.entryUrl}
        allow="tools"
        title={pin.label}
        className="size-full border-0"
        onLoad={onLoad}
      />
    </AppWindow.Root>
  );
}
