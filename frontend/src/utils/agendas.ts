import type { CoordAgent } from "@/components/coordination/coordinationApi";

/** Papéis que têm loop-script (cron-capable) — espelha ROLE_LOOP_SCRIPT do backend. */
export const CRON_ROLES = ["office-manager", "triador", "qa", "devops"] as const;

export interface AgendaPartition {
  scheduled: CoordAgent[]; // cron-capable COM cron_expr
  eligible: CoordAgent[]; // cron-capable SEM cron_expr (podem ganhar agenda)
}

/** Separa os agentes cron-capable em "já agendados" e "elegíveis a criar agenda".
 *  Agentes de papéis sem loop ficam fora dos dois. (Arquivados nem chegam aqui:
 *  o GET default já os exclui.) */
export function partitionAgendas(agents: CoordAgent[]): AgendaPartition {
  const cron = agents.filter((a) => (CRON_ROLES as readonly string[]).includes(a.role));
  return {
    scheduled: cron.filter((a) => a.cron_expr),
    eligible: cron.filter((a) => !a.cron_expr),
  };
}
