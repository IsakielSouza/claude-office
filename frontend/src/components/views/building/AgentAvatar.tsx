"use client";

import type { AgentChip } from "./viewModel";

const STATE_RING: Record<string, string> = {
  working: "ring-2 ring-emerald-400 animate-pulse",
  thinking: "ring-2 ring-sky-400 animate-pulse",
  walking_to_desk: "ring-2 ring-amber-400",
  waiting: "ring-1 ring-slate-500",
  waiting_permission: "ring-2 ring-rose-400 animate-pulse",
  idle: "ring-1 ring-slate-600",
};

export interface AgentAvatarProps {
  chip: AgentChip;
}

/** Small tinted avatar representing one agent in the building view. */
export function AgentAvatar({ chip }: AgentAvatarProps): React.ReactNode {
  const ring = STATE_RING[chip.state] ?? "ring-1 ring-slate-600";
  return (
    <div
      className="flex flex-col items-center gap-0.5"
      title={`${chip.label} — ${chip.state}${chip.task ? `: ${chip.task}` : ""}`}
      data-agent-id={chip.id}
    >
      <div
        className={`w-5 h-5 rounded-sm ${ring}`}
        style={{ backgroundColor: chip.color }}
      />
      <span className="text-[9px] leading-none text-slate-400 max-w-[3.5rem] truncate">
        {chip.isBoss ? "👑" : ""}
        {chip.label}
      </span>
    </div>
  );
}
