import { z } from "zod";

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

export const customProviderSchema = z.strictObject({
  id: customProviderIdSchema,
  label: z.string().trim().min(1).max(80),
  origin: z.url(),
  entryUrl: z.url(),
  icon: customProviderIconSchema,
  source: z.literal("custom"),
  capability: z.literal("discovery-only"),
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

export const workspacePreferencesSchema = z
  .strictObject({
    version: z.literal(1),
    customProviders: z.array(customProviderSchema).max(MAX_CUSTOM_PROVIDERS),
    dock: z.array(dockReferenceSchema).max(MAX_DOCK_APPS),
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
  };
}
