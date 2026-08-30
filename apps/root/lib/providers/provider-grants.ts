import type { NormalizedToolDescriptor } from "@repo/contracts";

export type ProviderGrantState =
  | "granted-live"
  | "discovered-ungranted"
  | "granted-missing";

export type ProviderGrantRow = {
  name: string;
  descriptor: NormalizedToolDescriptor | null;
  state: ProviderGrantState;
};

export type ProviderGrantBadge = {
  label: string;
  variant: "success" | "warning" | "muted";
};

export function grantBadgeForRow(row: ProviderGrantRow): ProviderGrantBadge {
  if (row.state === "granted-missing") {
    return { label: "Granted · missing", variant: "warning" };
  }
  if (row.state === "granted-live") {
    return { label: "Granted · live", variant: "success" };
  }
  if (row.descriptor?.readOnlyHint === true) {
    return { label: "Discovered", variant: "muted" };
  }
  return { label: "Discovered · may write", variant: "warning" };
}

export function deriveProviderGrantRows(
  grantedTools: readonly string[],
  discoveredTools: readonly NormalizedToolDescriptor[],
): ProviderGrantRow[] {
  const grants = new Set(grantedTools);
  const rows = discoveredTools.map((descriptor): ProviderGrantRow => ({
    name: descriptor.name,
    descriptor,
    state: grants.has(descriptor.name)
      ? "granted-live"
      : "discovered-ungranted",
  }));
  const live = new Set(discoveredTools.map((tool) => tool.name));
  for (const name of grantedTools) {
    if (!live.has(name)) {
      rows.push({ name, descriptor: null, state: "granted-missing" });
    }
  }
  return rows;
}
