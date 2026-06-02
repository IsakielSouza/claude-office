import type { CoordTask, HitlPrompt } from "./coordinationApi";

export type TaskStatus =
  | "open"
  | "todo"
  | "pending"
  | "waiting_agent"
  | "running"
  | "error"
  | "done"
  | "unknown";

export type TaskGroup = "need_you" | "in_progress" | "queue" | "history";

const AREA_LABEL = /^area:|^afk$/;

/** Traduz os campos técnicos (issue + claim + run + hitl) num status humano. */
export function deriveStatus(
  task: CoordTask,
  hitlPrompts: HitlPrompt[],
): TaskStatus {
  if (task.state === "CLOSED") return "done";

  const claim = task.claim_status;
  if (claim === "in_progress" || task.run_status === "running") return "running";

  const hasPendingPrompt = hitlPrompts.some(
    (p) => p.source_ref === task.source_ref && p.status === "pending",
  );
  if (hasPendingPrompt || task.labels.includes("hitl")) return "pending";

  if (claim === "claimed") return "waiting_agent";

  if (task.run_status === "error" || task.run_status === "timeout")
    return "error";

  if (task.state === "OPEN") {
    return task.labels.some((l) => AREA_LABEL.test(l)) ? "todo" : "open";
  }
  return "unknown";
}

export function statusGroup(status: TaskStatus): TaskGroup {
  switch (status) {
    case "pending":
    case "error":
      return "need_you";
    case "running":
    case "waiting_agent":
      return "in_progress";
    case "todo":
    case "open":
    case "unknown":
      return "queue";
    case "done":
      return "history";
  }
}

export interface GroupedTasks {
  need_you: CoordTask[];
  in_progress: CoordTask[];
  queue: CoordTask[];
}

const byNumberAsc = (a: CoordTask, b: CoordTask): number => a.number - b.number;

/** Agrupa as tasks vivas (exclui done) e ordena cada grupo por nº crescente. */
export function groupAndSortTasks(
  tasks: CoordTask[],
  hitlPrompts: HitlPrompt[],
): GroupedTasks {
  const out: GroupedTasks = { need_you: [], in_progress: [], queue: [] };
  for (const t of tasks) {
    const g = statusGroup(deriveStatus(t, hitlPrompts));
    if (g === "history") continue;
    out[g].push(t);
  }
  out.need_you.sort(byNumberAsc);
  out.in_progress.sort(byNumberAsc);
  out.queue.sort(byNumberAsc);
  return out;
}

export interface StuckTime {
  label: string;
  overdue: boolean;
}

/** Tempo decorrido desde `iso` até `nowMs`, com flag overdue acima de `limitMs`. */
export function formatStuckTime(
  iso: string | null,
  nowMs: number,
  limitMs: number,
): StuckTime {
  if (!iso) return { label: "", overdue: false };
  const elapsed = nowMs - Date.parse(iso);
  if (Number.isNaN(elapsed) || elapsed < 0) return { label: "", overdue: false };
  const min = Math.floor(elapsed / 60_000);
  const hours = Math.floor(min / 60);
  const days = Math.floor(hours / 24);
  let label: string;
  if (min < 60) label = `${min}min`;
  else if (hours < 24) label = `${hours}h`;
  else label = `${days}d ${hours - days * 24}h`;
  return { label, overdue: elapsed >= limitMs };
}

/** Quantas tasks estão no grupo "Precisa de você" (pending + error). */
export function needYouCount(
  tasks: CoordTask[],
  hitlPrompts: HitlPrompt[],
): number {
  return tasks.filter(
    (t) => statusGroup(deriveStatus(t, hitlPrompts)) === "need_you",
  ).length;
}

/** Limite padrão de SLA antes de marcar como atrasado: 4h. */
export const DEFAULT_SLA_MS = 4 * 3600_000;
