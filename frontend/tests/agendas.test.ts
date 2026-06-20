import { describe, it, expect } from "vitest";
import { partitionAgendas, CRON_ROLES } from "../src/utils/agendas";
import type { CoordAgent } from "../src/components/coordination/coordinationApi";

function mk(nome: string, role: string, cron_expr: string | null): CoordAgent {
  return {
    nome,
    role,
    projetos: [],
    mode: "persistent-24-7",
    contratado_em: null,
    last_active_at: null,
    status: "offline",
    active_claims: 0,
    queued_requests: 0,
    cron_expr,
    enabled: true,
    archived_at: null,
    model: null,
    current_ref: null,
    current_title: null,
    recent_done: [],
    effort_level: null,
    thinking_enabled: null,
  };
}

describe("partitionAgendas", () => {
  it("separa agendados de elegíveis (cron-capable sem cron)", () => {
    const ags = [
      mk("DEVOPS-HMTRACK-1", "devops", "0 8,12,15,18,23 * * *"),
      mk("DEVOPS-HMTRACK-2", "devops", null),
      mk("DEV-FRONT", "dev-front", "0,30 * * * *"), // dev-* É cron-capable → scheduled
      mk("DEV-API-1", "dev-api", null), // dev-* sem cron → eligible
      mk("TRIADOR-1", "triador", "0,15,30,45 7-23 * * *"),
      mk("PROTOCOLOS-1", "protocolos", "0 9 * * *"), // role sem loop → fora dos dois
    ];
    const { scheduled, eligible } = partitionAgendas(ags);
    expect(scheduled.map((a) => a.nome)).toEqual([
      "DEVOPS-HMTRACK-1",
      "DEV-FRONT",
      "TRIADOR-1",
    ]);
    expect(eligible.map((a) => a.nome)).toEqual([
      "DEVOPS-HMTRACK-2",
      "DEV-API-1",
    ]);
  });

  it("CRON_ROLES tem os 4 papéis com loop", () => {
    expect(CRON_ROLES).toEqual(["office-manager", "triador", "qa", "devops"]);
  });
});
