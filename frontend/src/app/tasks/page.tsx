"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { CoordinationNav } from "@/components/coordination/CoordinationNav";
import { useCoordinationPoll } from "@/components/coordination/useCoordinationPoll";
import { fetchTasks } from "@/components/coordination/coordinationApi";

const CLAIM_COLORS: Record<string, string> = {
  claimed: "text-sky-400",
  in_progress: "text-amber-400",
  done: "text-emerald-400",
  released: "text-slate-500",
};

const RUN_COLORS: Record<string, string> = {
  running: "text-sky-400",
  success: "text-emerald-400",
  error: "text-rose-400",
  timeout: "text-amber-400",
};

export default function TasksPage(): React.ReactNode {
  const [state, setState] = useState("");
  const [project, setProject] = useState("");

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (state) p.set("state", state);
    if (project) p.set("project", project);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [state, project]);

  const { data, loading, unavailable, error, refetch } = useCoordinationPoll(
    () => fetchTasks(qs),
    [qs],
  );

  return (
    <main className="min-h-screen bg-neutral-950 text-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="text-orange-500">Claude</span> Coordenação
        </h1>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Voltar ao escritório
        </Link>
      </div>

      <CoordinationNav />

      <div className="flex flex-wrap gap-2 items-center mb-3">
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
        >
          <option value="">Todos estados</option>
          <option value="OPEN">OPEN</option>
          <option value="CLOSED">CLOSED</option>
        </select>
        <input
          placeholder="project (ex.: hmtrack-api-py)"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-56"
        />
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-sm font-bold transition-colors"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
        {data && (
          <span className="text-xs text-slate-500">{data.tasks.length} tasks</span>
        )}
      </div>

      {unavailable && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded text-sm">
          DB de coordenação (:5433) indisponível. Verifique se o container
          <code className="mx-1 px-1 bg-slate-800 rounded">
            hmtrack-coordination-db
          </code>
          está no ar.
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded text-sm">
          Erro ao carregar: {error}
        </div>
      )}
      {loading && !data && <p className="text-slate-500 text-sm">Carregando…</p>}

      {data && !unavailable && (
        <div className="overflow-x-auto border border-slate-800 rounded-lg">
          <table className="w-full text-sm">
            <thead className="text-slate-500 text-left bg-slate-900/50">
              <tr>
                <th className="px-3 py-2 font-bold">#</th>
                <th className="px-3 py-2 font-bold">Título</th>
                <th className="px-3 py-2 font-bold">Estado</th>
                <th className="px-3 py-2 font-bold">Project</th>
                <th className="px-3 py-2 font-bold">Claim</th>
                <th className="px-3 py-2 font-bold">Último run</th>
              </tr>
            </thead>
            <tbody>
              {data.tasks.map((t) => (
                <tr
                  key={t.source_ref}
                  className="border-t border-slate-900 hover:bg-slate-900/40"
                >
                  <td className="px-3 py-2 font-mono text-slate-400">
                    {t.number}
                  </td>
                  <td className="px-3 py-2 max-w-md truncate">
                    {t.url ? (
                      <a
                        href={t.url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-sky-400"
                      >
                        {t.title}
                      </a>
                    ) : (
                      (t.title ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        t.state === "OPEN" ? "text-emerald-400" : "text-slate-500"
                      }
                    >
                      {t.state ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-400">{t.project ?? "—"}</td>
                  <td className="px-3 py-2">
                    {t.claim_status ? (
                      <span className={CLAIM_COLORS[t.claim_status] ?? "text-slate-300"}>
                        {t.claim_status}
                        {t.claim_agent ? ` (${t.claim_agent})` : ""}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {t.run_status ? (
                      <span className={RUN_COLORS[t.run_status] ?? "text-slate-300"}>
                        {t.run_status}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.tasks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-600">
                    Nenhuma task encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
