import { describe, it, expect } from "vitest";
import { partitionAgendas, CRON_ROLES } from "../src/utils/agendas";
import type { CoordAgent } from "../src/components/coordination/coordinationApi";

function mk(nome: string, role: string, cron_expr: string | null): CoordAgent {
  return {
    nome, role, projetos: [], mode: "persistent-24-7",
    contratado_em: null, last_active_at: null, status: "offline",
    active_claims: 0, queued_requests: 0,
    cron_expr, enabled: true, archived_at: null, model: null,
  };
}

describe("partitionAgendas", () => {
  it("separa agendados de elegíveis (cron-capable sem cron)", () => {
    const ags = [
      mk("DEVOPS-HMTRACK-1", "devops", "0 8,12,15,18,23 * * *"),
      mk("DEVOPS-HMTRACK-2", "devops", null),
      mk("DEV-API-1", "dev-api", null),        // não cron-capable → fora dos dois
      mk("TRIADOR-1", "triador", "0,15,30,45 7-23 * * *"),
    ];
    const { scheduled, eligible } = partitionAgendas(ags);
    expect(scheduled.map((a) => a.nome)).toEqual(["DEVOPS-HMTRACK-1", "TRIADOR-1"]);
    expect(eligible.map((a) => a.nome)).toEqual(["DEVOPS-HMTRACK-2"]);
  });

  it("CRON_ROLES tem os 4 papéis com loop", () => {
    expect(CRON_ROLES).toEqual(["office-manager", "triador", "qa", "devops"]);
  });
});
