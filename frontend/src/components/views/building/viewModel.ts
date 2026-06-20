import type { FloorLive } from "@/types";

/**
 * Fallback boss/lead color. The backend now sends a per-session `bossColor`
 * derived from a stable hash of the session_id so distinct sessions get
 * distinct colors; this constant is only used when that field is absent.
 */
export const BOSS_COLOR = "#f59e0b";

/** One rendered avatar within a floor row. */
export interface AgentChip {
  id: string;
  label: string;
  state: string;
  task: string | null;
  color: string;
  isBoss: boolean;
}

/** Flatten a floor's sessions into a flat list of avatar chips (boss + subagents). */
export function buildFloorChips(floor: FloorLive): AgentChip[] {
  const chips: AgentChip[] = [];
  for (const session of floor.sessions ?? []) {
    chips.push({
      id: `${session.sessionId}:boss`,
      label: session.displayName,
      state: session.bossState,
      task: session.bossTask ?? null,
      color: session.bossColor ?? BOSS_COLOR,
      isBoss: true,
    });
    for (const agent of session.agents ?? []) {
      chips.push({
        id: agent.id,
        label: agent.name ?? agent.id,
        state: agent.state,
        task: agent.task ?? null,
        color: agent.color,
        isBoss: false,
      });
    }
  }
  return chips;
}
