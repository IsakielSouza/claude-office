"use client";

import type { FloorConfig } from "@/types/navigation";
import type { FloorLive } from "@/types";
import { buildFloorChips } from "./viewModel";
import { AgentAvatar } from "./AgentAvatar";

export interface FloorRowLiveProps {
  floor: FloorConfig;
  live: FloorLive | undefined;
  onClick: (origin: { x: number; y: number }) => void;
}

/** A single floor rendered live: badge, agents, current-task bubble, empty state. */
export function FloorRowLive({
  floor,
  live,
  onClick,
}: FloorRowLiveProps): React.ReactNode {
  const chips = live ? buildFloorChips(live) : [];
  const isActive = live?.isActive ?? false;
  const agentCount = live?.agentCount ?? 0;
  const firstTask = chips.find((c) => c.task)?.task ?? null;

  return (
    <button
      onClick={(e) => onClick({ x: e.clientX, y: e.clientY })}
      data-tour-id={`floor-${floor.id}`}
      data-floor-id={floor.id}
      className={`group flex items-stretch w-full rounded-lg border transition-all duration-200 ${
        isActive
          ? "border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800"
          : "border-slate-800 bg-slate-900/30 opacity-60 hover:opacity-90"
      }`}
    >
      {/* Floor number badge */}
      <div
        className="flex items-center justify-center w-16 rounded-l-lg text-2xl font-bold font-mono"
        style={{ backgroundColor: floor.accent + "20", color: floor.accent }}
      >
        {floor.floorNumber}F
      </div>

      {/* Floor info + agents */}
      <div className="flex-grow flex items-center gap-4 px-5 py-3 min-w-0">
        <span className="text-2xl">{floor.icon}</span>
        <div className="flex flex-col items-start min-w-0">
          <span className="text-lg font-bold" style={{ color: floor.accent }}>
            {floor.name}
          </span>
          {isActive ? (
            <div className="flex items-center gap-2 mt-1">
              {chips.slice(0, 6).map((chip) => (
                <AgentAvatar key={chip.id} chip={chip} />
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-600 font-mono">
              vazio · luzes apagadas
            </span>
          )}
          {firstTask && (
            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[18rem] mt-1">
              💬 {firstTask}
            </span>
          )}
        </div>
      </div>

      {/* Agent count badge */}
      {agentCount > 0 && (
        <div className="flex items-center px-3">
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
            ⚡ {agentCount}
          </span>
        </div>
      )}

      {/* Arrow */}
      <div className="flex items-center px-4 text-slate-600 group-hover:text-slate-400 transition-colors">
        &rarr;
      </div>
    </button>
  );
}
