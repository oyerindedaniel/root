import { z } from "zod";
import { MAX_PROVIDER_TOOLS, webmcpToolNameSchema } from "@repo/contracts";

export const MAX_CUSTOM_PROVIDERS = 24;
export const MAX_DOCK_APPS = 32;
export const MAX_ICON_DATA_URL_CHARS = 64 * 1024;

export const customProviderIdSchema = z
  .string()
  .regex(/^custom-[a-z0-9][a-z0-9-]{7,56}$/);

export const customProviderIconSchema = z
  .string()
  .startsWith("data:image/webp;base64,")
  .max(MAX_ICON_DATA_URL_CHARS);

export const customProviderSchema = z
  .strictObject({
    id: customProviderIdSchema,
    label: z.string().trim().min(1).max(80),
    origin: z.url(),
    entryUrl: z.url(),
    icon: customProviderIconSchema,
    source: z.literal("custom"),
    capability: z.literal("discovery-only"),
    grantedTools: z
      .array(webmcpToolNameSchema)
      .max(MAX_PROVIDER_TOOLS)
      .default([]),
  })
  .superRefine((provider, context) => {
    if (new Set(provider.grantedTools).size !== provider.grantedTools.length) {
      context.addIssue({
        code: "custom",
        message: "Granted tool names must be unique.",
        path: ["grantedTools"],
      });
    }
  });

export type CustomProvider = z.infer<typeof customProviderSchema>;

export const providerDockReferenceSchema = z.strictObject({
  kind: z.literal("provider"),
  id: z.string().min(1).max(64),
});

export const systemDockReferenceSchema = z.strictObject({
  kind: z.literal("system"),
  id: z.literal("cases"),
});

export const dockReferenceSchema = z.discriminatedUnion("kind", [
  providerDockReferenceSchema,
  systemDockReferenceSchema,
]);

export type DockReference = z.infer<typeof dockReferenceSchema>;

export const workspacePanelSchema = z.strictObject({
  tab: z.enum(["activity", "apps"]),
  appsScrollTop: z.number().int().min(0).max(100_000),
});

export type WorkspacePanel = z.infer<typeof workspacePanelSchema>;

export const DEFAULT_WORKSPACE_PANEL: WorkspacePanel = {
  tab: "activity",
  appsScrollTop: 0,
};

export const workspacePreferencesSchema = z
  .strictObject({
    version: z.literal(1),
    customProviders: z.array(customProviderSchema).max(MAX_CUSTOM_PROVIDERS),
    dock: z.array(dockReferenceSchema).max(MAX_DOCK_APPS),
    panel: workspacePanelSchema.default(DEFAULT_WORKSPACE_PANEL),
  })
  .superRefine((preferences, context) => {
    const providerIds = new Set<string>();
    for (const provider of preferences.customProviders) {
      if (providerIds.has(provider.id)) {
        context.addIssue({
          code: "custom",
          message: "Custom provider IDs must be unique.",
          path: ["customProviders"],
        });
      }
      providerIds.add(provider.id);
    }
    const dockIds = new Set<string>();
    for (const reference of preferences.dock) {
      const key = `${reference.kind}:${reference.id}`;
      if (dockIds.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Dock references must be unique.",
          path: ["dock"],
        });
      }
      dockIds.add(key);
    }
  });

export type WorkspacePreferences = z.infer<typeof workspacePreferencesSchema>;

export const DEFAULT_DOCK: readonly DockReference[] = [
  { kind: "provider", id: "accounts" },
  { kind: "provider", id: "shop" },
  { kind: "system", id: "cases" },
];

export function createDefaultWorkspacePreferences(): WorkspacePreferences {
  return {
    version: 1,
    customProviders: [],
    dock: DEFAULT_DOCK.map((reference) => ({ ...reference })),
    panel: { ...DEFAULT_WORKSPACE_PANEL },
  };
}
