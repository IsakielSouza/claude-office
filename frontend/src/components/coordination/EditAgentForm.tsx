"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { patchAgent, type CoordAgent } from "./coordinationApi";

export function EditAgentForm({
  agent,
  onSaved,
}: {
  agent: CoordAgent;
  onSaved?: () => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(agent.role);
  const [projetos, setProjetos] = useState(agent.projetos.join(", "));
  const [mode, setMode] = useState<"on-demand" | "persistent-24-7">(
    agent.mode === "persistent-24-7" ? "persistent-24-7" : "on-demand",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(): Promise<void> {
    setBusy(true);
    setErr(null);
    try {
      await patchAgent(agent.nome, {
        role: role.trim(),
        projetos: projetos.split(",").map((s) => s.trim()).filter(Boolean),
        mode,
      });
      setOpen(false);
      onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm flex items-center gap-1">
        <Pencil size={14} /> editar
      </button>
    );
  }
  return (
    <div className="rounded border border-neutral-700 p-3 space-y-2">
      <div className="flex justify-between"><span className="font-medium">{agent.nome}</span>
        <button onClick={() => setOpen(false)}><X size={14} /></button></div>
      <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="função" className="w-full bg-neutral-900 rounded px-2 py-1 text-sm" />
      <input value={projetos} onChange={(e) => setProjetos(e.target.value)} placeholder="projetos (vírgula)" className="w-full bg-neutral-900 rounded px-2 py-1 text-sm" />
      <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} className="bg-neutral-900 rounded px-2 py-1 text-sm">
        <option value="on-demand">on-demand</option>
        <option value="persistent-24-7">persistent-24-7</option>
      </select>
      {err && <div className="text-xs text-red-400">{err}</div>}
      <button onClick={save} disabled={busy} className="rounded bg-blue-600 px-3 py-1 text-sm disabled:opacity-50">salvar</button>
    </div>
  );
}
