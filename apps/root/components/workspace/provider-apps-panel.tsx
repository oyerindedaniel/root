"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  InformationCircleIcon,
  PhotoIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react";
import Image from "next/image";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SubmitEvent,
} from "react";
import type { NormalizedToolDescriptor } from "@repo/contracts";

import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { Input } from "@repo/ui/input";
import { Label } from "@repo/ui/label";
import { Switch } from "@repo/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui/tooltip";

import { instanceIdsForProvider } from "@/lib/desktop/library-edit";
import { providerKey } from "@/lib/providers/catalog";
import {
  deriveProviderGrantRows,
  grantBadgeForRow,
} from "@/lib/providers/provider-grants";
import { useProviderLibrary } from "@/lib/providers/provider-library";
import { useRuntime } from "@/lib/runtime/runtime-context";
import {
  MAX_SOURCE_ICON_BYTES,
  normalizeProviderIcon,
} from "@/lib/storage/provider-icon";
import type {
  CustomProvider,
  DockReference,
} from "@/lib/storage/workspace-preferences";

export function ProviderAppsPanel() {
  const library = useProviderLibrary();
  const { testProvider, closeProvider, state } = useRuntime();
  const [editing, setEditing] = useState<CustomProvider | "new" | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [liveTools, setLiveTools] = useState<
    Record<
      string,
      {
        origin: string;
        entryUrl: string;
        tools: NormalizedToolDescriptor[];
      }
    >
  >({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmWriteGrant, setConfirmWriteGrant] = useState<string | null>(
    null,
  );
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestScrollTopRef = useRef(library.preferences.panel.appsScrollTop);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scroll) {
      scroll.scrollTop = library.preferences.panel.appsScrollTop;
    }
  }, [library.preferences.panel.appsScrollTop]);

  useEffect(
    () => () => {
      if (scrollSaveRef.current) {
        clearTimeout(scrollSaveRef.current);
        scrollSaveRef.current = null;
        library.setAppsScrollTop(latestScrollTopRef.current);
      }
    },
    [library],
  );

  async function test(providerId: string) {
    setTesting(providerId);
    setStatus(null);
    setConfirmWriteGrant(null);
    const provider = library.catalog.providers.find(
      (entry) => providerKey(entry) === providerId,
    );
    setLiveTools((current) => {
      const next = { ...current };
      delete next[providerId];
      return next;
    });
    const result = await testProvider(providerId);
    setTesting(null);
    if (result.status === "success") {
      setLiveTools((current) => ({
        ...current,
        [providerId]: {
          origin: result.data.origin,
          entryUrl: provider?.entryUrl ?? "",
          tools: result.data.tools,
        },
      }));
    }
    setStatus(
      result.status === "success"
        ? `${result.data.tools.length} tool${result.data.tools.length === 1 ? "" : "s"} discovered`
        : result.message,
    );
  }

  return (
    <div
      ref={scrollRef}
      className="scrollbar-none max-h-[min(28rem,70vh)] overflow-y-auto p-2"
      onScroll={(event) => {
        const scrollTop = event.currentTarget.scrollTop;
        if (scrollTop === library.preferences.panel.appsScrollTop) {
          return;
        }
        latestScrollTopRef.current = scrollTop;
        if (scrollSaveRef.current) {
          clearTimeout(scrollSaveRef.current);
        }
        scrollSaveRef.current = setTimeout(() => {
          scrollSaveRef.current = null;
          library.setAppsScrollTop(latestScrollTopRef.current);
        }, 120);
      }}
    >
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <p className="text-sm text-white/60">
          {library.storageFailure
            ? "Local preferences recovered to defaults."
            : "Installed providers and Dock order."}
        </p>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={() => setEditing("new")}
        >
          <PlusIcon className="size-4" />
          Add
        </Button>
      </div>
      <LayoutGroup>
        <AnimatePresence initial={false} mode="popLayout">
          {editing ? (
            <motion.div
              key={editing === "new" ? "new" : editing.id}
              layout
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
              }
            >
              <ProviderForm
                provider={editing === "new" ? null : editing}
                onClose={() => setEditing(null)}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
        <div className="space-y-1">
          {library.catalog.providers.map((provider) => {
            const id = providerKey(provider);
            const reference: DockReference = { kind: "provider", id };
            const pinned = library.isPinned(reference);
            const discovery = liveTools[id];
            const discoveredTools =
              discovery?.origin === provider.origin &&
              discovery.entryUrl === provider.entryUrl
                ? discovery.tools
                : [];
            return (
              <motion.div
                key={id}
                layout="position"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
                }
                className="rounded-xl bg-white/6 p-2 ring-1 ring-white/10"
              >
              <div className="flex items-center gap-2">
                <Image
                  src={provider.icon}
                  alt=""
                  width={32}
                  height={32}
                  unoptimized
                  className="size-8 shrink-0 rounded-[20%]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {provider.label}
                  </p>
                  <p className="truncate text-xs text-white/45">
                    {provider.source === "custom" &&
                    provider.grantedTools.length > 0
                      ? "granted-invoke"
                      : provider.capability}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  className="px-3 text-white hover:bg-white/10"
                  onClick={() =>
                    pinned ? library.unpin(reference) : library.pin(reference)
                  }
                >
                  {pinned ? "Unpin" : "Pin"}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <Button
                  variant="ghost"
                  className="px-3 text-white hover:bg-white/10"
                  pending={testing === id}
                  onClick={() => void test(id)}
                >
                  Test
                </Button>
                {pinned ? (
                  <>
                    <IconButton
                      label={`Move ${provider.label} left`}
                      onClick={() => library.move(reference, -1)}
                    >
                      <ArrowLeftIcon className="size-4" />
                    </IconButton>
                    <IconButton
                      label={`Move ${provider.label} right`}
                      onClick={() => library.move(reference, 1)}
                    >
                      <ArrowRightIcon className="size-4" />
                    </IconButton>
                  </>
                ) : null}
                {provider.source === "custom" ? (
                  <>
                    <IconButton
                      label={`Edit ${provider.label}`}
                      onClick={() => setEditing(provider)}
                    >
                      <PencilSquareIcon className="size-4" />
                    </IconButton>
                    <Button
                      variant={
                        confirmDelete === id ? "destructive" : "ghost"
                      }
                      className={
                        confirmDelete === id
                          ? "px-3"
                          : "px-3 text-white hover:bg-white/10"
                      }
                      onClick={() => {
                        if (confirmDelete === id) {
                          for (const instanceId of instanceIdsForProvider(
                            Object.values(state.windows),
                            id,
                          )) {
                            closeProvider(instanceId);
                          }
                          library.deleteProvider(id);
                          setConfirmDelete(null);
                        } else {
                          setConfirmDelete(id);
                        }
                      }}
                    >
                      <TrashIcon className="size-4" />
                      {confirmDelete === id ? "Confirm delete" : "Delete"}
                    </Button>
                  </>
                ) : null}
              </div>
                {provider.source === "custom" &&
                (discoveredTools.length > 0 ||
                  provider.grantedTools.length > 0) ? (
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                    {deriveProviderGrantRows(
                      provider.grantedTools,
                      discoveredTools,
                    ).map((row) => {
                      const granted = row.state !== "discovered-ungranted";
                      const confirmationKey = `${id}:${row.name}`;
                      const confirming =
                        confirmWriteGrant === confirmationKey;
                      const badge = grantBadgeForRow(row);
                      const description =
                        row.descriptor &&
                        row.descriptor.description !== row.descriptor.name
                          ? row.descriptor.description
                          : null;
                      return (
                        <div key={row.name}>
                          <label className="flex min-h-8 items-start gap-2 rounded-lg px-2 py-1.5 text-xs text-white/75 hover:bg-white/6">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{row.name}</span>
                              {description ? (
                                <span className="mt-0.5 block wrap-break-word text-white/55">
                                  {description}
                                </span>
                              ) : null}
                            </span>
                            <Badge
                              variant={badge.variant}
                              className="mt-0.5 h-5 rounded-full px-2 text-xs"
                            >
                              {badge.label}
                            </Badge>
                            <Switch
                              className="mt-0.5"
                              checked={granted}
                              aria-label={`${granted ? "Revoke" : "Grant"} ${row.name}`}
                              onCheckedChange={(checked) => {
                                if (
                                  checked &&
                                  row.descriptor?.readOnlyHint !== true
                                ) {
                                  setConfirmWriteGrant(confirmationKey);
                                  return;
                                }
                                setConfirmWriteGrant(null);
                                library.setGrantedTools(
                                  id,
                                  checked
                                    ? [...provider.grantedTools, row.name]
                                    : provider.grantedTools.filter(
                                        (name) => name !== row.name,
                                      ),
                                );
                              }}
                            />
                          </label>
                          {confirming ? (
                            <div
                              role="alert"
                              className="mx-2 mb-1 flex flex-wrap items-center gap-2 px-2 py-1.5 text-xs text-white/55"
                            >
                              <span className="min-w-0 flex-1">
                                This tool may change data.
                              </span>
                              <Button
                                variant="primary"
                                onClick={() => {
                                  library.setGrantedTools(id, [
                                    ...provider.grantedTools,
                                    row.name,
                                  ]);
                                  setConfirmWriteGrant(null);
                                }}
                              >
                                Grant
                              </Button>
                              <Button
                                variant="ghost"
                                className="text-white hover:bg-white/10"
                                onClick={() => setConfirmWriteGrant(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
      <div className="mt-2 flex items-center justify-between gap-3 px-1">
        <span role="status" className="text-xs text-white/55">
          {status}
        </span>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={library.resetDock}
        >
          Reset Dock
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function ProviderForm({
  provider,
  onClose,
}: {
  provider: CustomProvider | null;
  onClose: () => void;
}) {
  const library = useProviderLibrary();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [iconPreview, setIconPreview] = useState(provider?.icon ?? null);
  const [iconName, setIconName] = useState<string | null>(null);
  const iconInputId = useId();
  const originInputId = useId();
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const form = new FormData(event.currentTarget);
      const file = form.get("icon");
      const icon =
        file instanceof File && file.size > 0
          ? await normalizeProviderIcon(file)
          : provider?.icon;
      if (!icon) {
        throw new Error("Choose a PNG, JPEG, or WebP icon.");
      }
      const values = {
        label: String(form.get("label") ?? ""),
        origin: String(form.get("origin") ?? ""),
        entryUrl: String(form.get("entryUrl") ?? ""),
        icon,
      };
      if (provider) {
        library.updateProvider({ ...provider, ...values });
      } else {
        library.addProvider(values);
      }
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Provider is invalid.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="mb-2 space-y-2 rounded-xl bg-black/35 p-3 ring-1 ring-white/12"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-white">
          {provider ? "Edit provider" : "Add provider"}
        </p>
        <Button
          variant="ghost"
          className="px-3 text-white hover:bg-white/10"
          onClick={onClose}
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>
      </div>
      <Label className="text-sm text-white/70">
        Label
        <Input
          name="label"
          required
          maxLength={80}
          defaultValue={provider?.label}
          className="border-white/15 bg-white/10 text-white"
        />
      </Label>
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label
            htmlFor={originInputId}
            className="text-sm text-white/70"
          >
            Origin
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                data-caliper-id="root-provider-origin-info"
                className="rounded-full p-0.5 text-white/50 hover:bg-white/10 hover:text-white/80"
                aria-label="When this site works"
              >
                <InformationCircleIcon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="z-[2147483647] max-w-xs py-1.5 leading-snug">
              A site you add only works if this browser can see that window’s
              tools. Chrome with WebMCP on can. As of today, Codex’s in-app
              browser cannot.
            </TooltipContent>
          </Tooltip>
        </div>
        <Input
          id={originInputId}
          name="origin"
          type="url"
          required
          defaultValue={provider?.origin}
          placeholder="https://app.example"
          className="border-white/15 bg-white/10 text-white"
        />
      </div>
      <Label className="text-sm text-white/70">
        Entry URL
        <Input
          name="entryUrl"
          type="url"
          required
          defaultValue={provider?.entryUrl}
          placeholder="https://app.example/"
          className="border-white/15 bg-white/10 text-white"
        />
      </Label>
      <div className="space-y-2">
        <span className="text-sm text-white/70">Icon</span>
        <label
          htmlFor={iconInputId}
          className="flex h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/6 px-3 outline-none hover:bg-white/10 focus-within:ring-2 focus-within:ring-white/60"
        >
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-[22%] bg-black/25 ring-1 ring-white/12">
            {iconPreview ? (
              <Image
                src={iconPreview}
                alt=""
                width={56}
                height={56}
                unoptimized
                className="size-14 object-contain"
              />
            ) : (
              <PhotoIcon className="size-6 text-white/45" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-white">
              Choose app icon
            </span>
            <span className="block truncate text-xs text-white/45">
              {iconName ?? "PNG, JPEG, or WebP up to 1.5 MB"}
            </span>
          </span>
          <input
            id={iconInputId}
            name="icon"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }
              if (
                file.size > MAX_SOURCE_ICON_BYTES ||
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
              ) {
                event.currentTarget.value = "";
                setError("Choose a PNG, JPEG, or WebP icon up to 1.5 MB.");
                return;
              }
              setError(null);
              if (objectUrlRef.current) {
                URL.revokeObjectURL(objectUrlRef.current);
              }
              const objectUrl = URL.createObjectURL(file);
              objectUrlRef.current = objectUrl;
              setIconPreview(objectUrl);
              setIconName(file.name);
            }}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <Button type="submit" pending={pending}>
          {provider ? "Save" : "Add provider"}
        </Button>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10"
          onClick={onClose}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
