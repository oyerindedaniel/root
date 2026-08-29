"use client";

import {
  boundedError,
  parseBoundedJsonResult,
  parseExecuteResultText,
  searchProductsOutputSchema,
  type BoundedResultEnvelope,
  type DiscoverCapabilitiesInput,
  type InspectWorkflowOutput,
  type Account,
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
import { prepareShopSearchStep, revalidatePreparedStep } from "@/lib/runtime/prepare";
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
import { getDocumentModelContext } from "@/lib/webmcp/model-context";
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

  const discoverCapabilities = useCallback(
    async (
      input: DiscoverCapabilitiesInput,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope> => {
      dispatch({ type: "control/set", control: "agent" });
      try {
        const shop = getTrustedProvider(directory, input.providerId);
        const instanceId = openProvider(input.providerId);
        await waitForLoad(instanceId);
        signal.throwIfAborted();
        dispatch({ type: "provider/discovering", instanceId });

        const modelContext = getDocumentModelContext(document);
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
          origin: shop.origin,
          expectedNames: shop.expectedTools,
          signal,
        });
        const normalized = rejectDuplicateToolNames(
          rawTools.map((tool) =>
            normalizeDiscoveredTool({
              providerId: "shop",
              instanceId,
              expectedOrigin: shop.origin,
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
            providerId: shop.providerId,
            origin: shop.origin,
            contractVersion: shop.contractVersion,
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
        return boundedError(code, "Catalog capability discovery failed.");
      } finally {
        dispatch({ type: "control/set", control: "human" });
      }
    },
    [directory, openProvider, waitForLoad],
  );

  const prepareWorkflow = useCallback((input: unknown): BoundedResultEnvelope => {
    const parsed = (input as { steps?: unknown[] }) ?? {};
    const workflowId = `wf_${crypto.randomUUID()}`;
    const prepared = prepareShopSearchStep({
      state: stateRef.current,
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      workflowId,
    });
    if (!prepared.ok) {
      return prepared.error;
    }
    dispatch({
      type: "workflow/prepared",
      workflowId: prepared.workflowId,
      step: prepared.step,
    });
    return {
      status: "success",
      data: {
        workflowId: prepared.workflowId,
        step: prepared.step,
      },
    };
  }, []);

  const executeWorkflow = useCallback(
    async (
      input: { workflowId: string },
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope> => {
      const current = stateRef.current;
      if (
        current.workflow.id !== input.workflowId ||
        current.workflow.lifecycle !== "prepared" ||
        !current.workflow.step ||
        !current.provider.instanceId
      ) {
        return boundedError(
          "workflow_not_prepared",
          "No prepared Catalog search matches that workflow.",
        );
      }
      const step = current.workflow.step;
      const revalidated = revalidatePreparedStep({ state: current, step });
      if (!revalidated.ok) {
        dispatch({ type: "workflow/invalidate" });
        return revalidated.error;
      }

      const modelContext = getDocumentModelContext(document);
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

      const rediscovered = await modelContext.getTools({
        fromOrigins: [step.origin],
      });
      const match = rediscovered.find(
        (tool) => tool.origin === step.origin && tool.name === step.toolName,
      );
      if (!match) {
        dispatch({ type: "workflow/invalidate" });
        return boundedError(
          "revalidation_failed",
          "The Catalog tool is no longer registered.",
        );
      }
      const normalized = normalizeDiscoveredTool({
        providerId: "shop",
        instanceId: current.provider.instanceId,
        expectedOrigin: step.origin,
        tool: match,
      });
      if (normalized.descriptor.schemaFingerprint !== step.schemaFingerprint) {
        dispatch({ type: "workflow/invalidate" });
        return boundedError(
          "revalidation_failed",
          "The Catalog tool contract changed since preparation.",
        );
      }
      handlesRef.current.set(
        current.provider.instanceId,
        step.origin,
        step.toolName,
        normalized.handle,
      );

      const combined = new AbortController();
      const onAbort = () => combined.abort();
      signal.addEventListener("abort", onAbort, { once: true });
      executionAbortRef.current = combined;

      dispatch({ type: "workflow/executing", workflowId: input.workflowId });
      try {
        const resultText = await executeRegisteredTool({
          modelContext,
          tool: normalized.handle,
          invokeKind: normalized.descriptor.invokeKind,
          input: step.arguments,
          signal: combined.signal,
        });
        const parsed = searchProductsOutputSchema.parse(
          parseBoundedJsonResult(parseExecuteResultText(resultText)),
        );
        dispatch({
          type: "workflow/passed",
          workflowId: input.workflowId,
          result: parsed,
          evidence: `${parsed.products.length} products for "${parsed.query}"`,
        });
        return { status: "success", data: parsed };
      } catch (error) {
        const cancelled =
          combined.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError");
        if (cancelled) {
          dispatch({
            type: "workflow/cancelled",
            workflowId: input.workflowId,
          });
          return boundedError("cancelled", "Catalog search was cancelled.");
        }
        dispatch({
          type: "workflow/failed",
          workflowId: input.workflowId,
          reason: "execution_failed",
        });
        return boundedError("execution_failed", "Catalog search failed.");
      } finally {
        signal.removeEventListener("abort", onAbort);
        executionAbortRef.current = null;
      }
    },
    [],
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
      const result =
        current.workflow.result === null
          ? null
          : {
              status: "success" as const,
              data: current.workflow.result,
            };
      return {
        workflowId: input.workflowId,
        lifecycle: current.workflow.lifecycle,
        step: current.workflow.step,
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
      shop: directory.shop,
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
    <AppWindow.Root title={pin.label} icon={pin.icon}>
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
