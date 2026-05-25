"use client";

import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { createTask } from "./coordinationApi";

/**
 * Form de criação de task (#383). Cria uma issue REAL no agents-ia via o backend
 * (`gh issue create`). O coletor-task sincroniza pro :5433 e o poll reflete depois.
 */
export function CreateTaskForm({
  onCreated,
}: {
  onCreated?: () => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [agent, setAgent] = useState("");
  const [labels, setLabels] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!title.trim()) {
      setError("título obrigatório");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await createTask({
        title: title.trim(),
        agent: agent.trim() || undefined,
        labels: labels
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        body: body.trim(),
      });
      setCreatedUrl(r.url);
      setTitle("");
      setBody("");
      setLabels("");
      onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-sm font-bold transition-colors"
      >
        <Plus size={14} /> Nova task
      </button>
    );
  }

  return (
    <div className="border border-slate-800 rounded-lg p-3 bg-slate-900/40 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-200">Nova task</span>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-300"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          placeholder="título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm flex-1 min-w-[16rem]"
        />
        <input
          placeholder="agente (ex.: hmtrack-front)"
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-56"
        />
        <input
          placeholder="labels (vírgula)"
          value={labels}
          onChange={(e) => setLabels(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-44"
        />
      </div>
      <textarea
        placeholder="descrição / contexto / critérios de aceite"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm w-full"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => void submit()}
          disabled={submitting}
          className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-sm font-bold transition-colors disabled:opacity-50"
        >
          {submitting ? "Criando…" : "Criar issue"}
        </button>
        {createdUrl && (
          <a
            href={createdUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            criada <ExternalLink size={11} />
          </a>
        )}
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>
    </div>
  );
}
