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
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { animateSuction, layoutFromRect, prefersReducedMotion } from "@/lib/motion/suction";
import {
  DirectoryError,
  getTrustedProvider,
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
}: {
  account: Account;
  directory: ProviderDirectory;
  children: ReactNode;
}) {
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

  const openCatalog = useCallback(() => {
    const current = stateRef.current;
    if (current.provider.instanceId) {
      return current.provider.instanceId;
    }
    const shop = getTrustedProvider(directory, "shop");
    const instanceId = `shop_${crypto.randomUUID()}`;
    dispatch({
      type: "provider/mount",
      instanceId,
      origin: shop.origin,
      entryUrl: shop.entryUrl,
    });
    return instanceId;
  }, [directory]);

  const discoverCapabilities = useCallback(
    async (
      input: DiscoverCapabilitiesInput,
      signal: AbortSignal,
    ): Promise<BoundedResultEnvelope> => {
      dispatch({ type: "control/set", control: "agent" });
      try {
        const shop = getTrustedProvider(directory, input.providerId);
        const instanceId = openCatalog();
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
    [directory, openCatalog, waitForLoad],
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
    const slot =
      placement === "stage" ? stageSlotRef.current : traySlotRef.current;
    if (!workspace || !surface || !slot) {
      return;
    }
    const layout = layoutFromRect(
      workspace.getBoundingClientRect(),
      slot.getBoundingClientRect(),
    );
    surface.style.top = `${layout.top}px`;
    surface.style.left = `${layout.left}px`;
    surface.style.width = `${layout.width}px`;
    surface.style.height = `${layout.height}px`;
    surface.inert = placement === "tray";
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
      motionAbortRef.current?.abort();
      const motionAbort = new AbortController();
      motionAbortRef.current = motionAbort;
      dispatch({ type: "placement/request", placement });
      surface.inert = true;
      const from = surface.getBoundingClientRect();
      applySurfaceLayout(placement);
      const to = surface.getBoundingClientRect();
      const finish = () => {
        surface.inert = placement === "tray";
        dispatch({ type: "motion/finish", placement });
        if (placement === "tray") {
          restoreButtonRef.current?.focus();
        } else {
          stageSlotRef.current?.focus();
        }
      };
      if (prefersReducedMotion()) {
        finish();
        return;
      }
      void animateSuction({
        surface,
        from,
        to,
        signal: motionAbort.signal,
      })
        .then(finish)
        .catch(() => {
          surface.inert =
            stateRef.current.provider.placement === "tray";
        });
    },
    [applySurfaceLayout],
  );

  useEffect(() => {
    if (state.provider.lifecycle === "unmounted") {
      return;
    }
    applySurfaceLayout(state.provider.placement);
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }
    const observer = new ResizeObserver(() => {
      applySurfaceLayout(stateRef.current.provider.placement);
    });
    observer.observe(workspace);
    return () => observer.disconnect();
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
      openCatalog,
    }),
    [account, directory, openCatalog, requestPlacement, state],
  );

  return (
    <RuntimeContextProvider value={api}>
      <div ref={workspaceRef} className="desktop-canvas relative flex h-dvh flex-col overflow-hidden">
        {children}
        <ProviderIframe
          state={state}
          iframeRef={iframeRef}
          surfaceRef={surfaceRef}
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
  iframeRef,
  surfaceRef,
  onLoad,
}: {
  state: RuntimeState;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  onLoad: () => void;
}) {
  if (state.provider.lifecycle === "unmounted" || !state.provider.entryUrl) {
    return null;
  }

  return (
    <div
      ref={surfaceRef}
      className={
        state.provider.placement === "tray"
          ? "pointer-events-none absolute z-20 overflow-hidden rounded-2xl bg-background"
          : "absolute z-10 overflow-hidden bg-background"
      }
    >
      <iframe
        ref={iframeRef}
        src={state.provider.entryUrl}
        allow="tools"
        title="Catalog"
        className="size-full border-0"
        onLoad={onLoad}
      />
    </div>
  );
}
