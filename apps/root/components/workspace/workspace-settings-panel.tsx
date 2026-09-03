"use client";

import type { PresentPaceName } from "@repo/contracts";
import { cn } from "@repo/ui/lib/cn";
import { Switch } from "@repo/ui/switch";

import { useProviderLibrary } from "@/lib/providers/provider-library";
import { requestPendingHumanNotifyPermission } from "@/lib/runtime/pending-human-notify";

const PACE_NAMES = ["slow", "default", "fast"] as const;

function paceLabel(name: PresentPaceName) {
  if (name === "slow") {
    return "Slow";
  }
  if (name === "fast") {
    return "Fast";
  }
  return "Default";
}

export function WorkspaceSettingsPanel() {
  const library = useProviderLibrary();
  const present = library.preferences.present;
  return (
    <div className="flex flex-col gap-3 p-3">
      <PaceRow
        label="Typing"
        hint="How fast the agent types in a field."
        value={present.fill}
        onChange={(fill) => library.setPresentPace({ fill })}
      />
      <PaceRow
        label="Before it clicks"
        hint="How long Search is held before it fires."
        value={present.preview}
        onChange={(preview) => library.setPresentPace({ preview })}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">Auto-select results</p>
          <p className="text-xs text-white/45">
            Choose the first search result after the preview.
          </p>
        </div>
        <Switch
          checked={library.preferences.selectionMode === "auto"}
          aria-label="Auto-select results"
          onCheckedChange={(checked) =>
            library.setSelectionMode(checked ? "auto" : "manual")
          }
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">Notify when a wait needs you</p>
          <p className="text-xs text-white/45">
            When this tab is hidden and the agent is waiting for a click.
          </p>
        </div>
        <Switch
          checked={library.preferences.notifyWait}
          aria-label="Notify when a wait needs you"
          onCheckedChange={async (checked) => {
            if (!checked) {
              library.setNotifyWait(false);
              return;
            }
            library.setNotifyWait(await requestPendingHumanNotifyPermission());
          }}
        />
      </div>
    </div>
  );
}

function PaceRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: PresentPaceName;
  onChange: (name: PresentPaceName) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-white/45">{hint}</p>
      </div>
      <div className="flex h-8 shrink-0 items-center gap-0.5 rounded-full bg-white/6 p-0.5">
        {PACE_NAMES.map((name) => {
          const selected = name === value;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected}
              className={cn(
                "h-7 rounded-full px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                selected
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
              )}
              onClick={() => onChange(name)}
            >
              {paceLabel(name)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
