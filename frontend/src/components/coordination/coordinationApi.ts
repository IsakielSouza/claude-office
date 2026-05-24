/**
 * Cliente read-only das rotas de coordenação (backend F1, lê o Postgres :5433).
 * Isolado em coordination/* para não colidir com o conceito interno "task" do office.
 */

const BASE = "http://localhost:8000/api/v1/coordination";

export interface CoordTask {
  number: number;
  title: string | null;
  state: string | null;
  labels: string[];
  project: string | null;
  url: string | null;
  source_ref: string;
  source_updated_at: string | null;
  claim_status: string | null;
  claim_agent: string | null;
  claim_mechanism: string | null;
  claimed_at: string | null;
  run_status: string | null;
  run_started_at: string | null;
  run_ended_at: string | null;
  run_agent: string | null;
}

export interface CoordRun {
  id: number;
  source_ref: string | null;
  project: string | null;
  agent: string | null;
  session_id: string | null;
  mechanism: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  exit_code: number | null;
  error_text: string | null;
  log_path: string | null;
  duration_seconds: number | null;
  issue_url: string | null;
  issue_title: string | null;
}

export interface CoordDashboard {
  github: { open: number; closed: number; total: number };
  database: { activeClaims: number; runsByStatus: Record<string, number> };
  closedByPeriod: {
    period: string;
    tz: string;
    buckets: { period: string; n: number }[];
  };
  openByProject: { project: string; n: number }[];
  health: {
    component: string;
    status: string;
    last_run: string | null;
    min_ago: number | null;
    error_text: string | null;
  }[];
}

/** Lançado quando o backend devolve 503 (DB de coordenação fora). */
export class CoordUnavailableError extends Error {
  constructor() {
    super("coordination_db_unavailable");
    this.name = "CoordUnavailableError";
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (res.status === 503) throw new CoordUnavailableError();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const fetchTasks = (qs = ""): Promise<{ tasks: CoordTask[] }> =>
  getJson<{ tasks: CoordTask[] }>(`/tasks${qs}`);

export const fetchRuns = (qs = ""): Promise<{ runs: CoordRun[] }> =>
  getJson<{ runs: CoordRun[] }>(`/agent-runs${qs}`);

export const fetchDashboard = (qs = ""): Promise<CoordDashboard> =>
  getJson<CoordDashboard>(`/dashboard${qs}`);
