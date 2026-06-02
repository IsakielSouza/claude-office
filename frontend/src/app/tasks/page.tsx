"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { CoordinationNav } from "@/components/coordination/CoordinationNav";
import { useTranslation, type TranslationKey } from "@/hooks/useTranslation";
import { useCoordinationPoll } from "@/components/coordination/useCoordinationPoll";
import {
  fetchTasks,
  fetchHitlPending,
  answerHitl,
  setTaskPriority,
  type CoordTask,
  type HitlPrompt,
  type HitlAnswerValue,
} from "@/components/coordination/coordinationApi";
import { batchApprovals } from "@/components/coordination/taskBatch";
import HitlAnswerModal from "@/components/coordination/HitlAnswerModal";
import { CreateTaskForm } from "@/components/coordination/CreateTaskForm";
import {
  deriveStatus,
  statusGroup,
  groupAndSortTasks,
  formatStuckTime,
  DEFAULT_SLA_MS,
  type TaskStatus,
} from "@/components/coordination/taskStatus";

/** Mark do GitHub inline (lucide removeu ícones de marca nesta versão). */
function GithubMark({ size = 18 }: { size?: number }): React.ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: "text-amber-400",
  error: "text-rose-400",
  running: "text-sky-400",
  waiting_agent: "text-sky-300",
  todo: "text-slate-200",
  open: "text-slate-400",
  done: "text-emerald-400",
  unknown: "text-slate-500",
};

// Qual timestamp medir o "tempo parado" por status.
function stuckSince(t: CoordTask, status: TaskStatus): string | null {
  if (status === "error") return t.run_ended_at ?? t.run_started_at;
  if (status === "running" || status === "waiting_agent")
    return t.claimed_at ?? t.run_started_at;
  return t.source_updated_at;
}

function agentModel(t: CoordTask, status: TaskStatus): string {
  const agent = status === "error" ? t.run_agent : (t.claim_agent ?? t.run_agent);
  const model = status === "error" ? t.run_model : (t.claim_model ?? t.run_model);
  if (!agent) return "";
  return model ? `${agent} · ${model}` : agent;
}

export default function TasksPage(): React.ReactNode {
  const { t: tr } = useTranslation();
  const [selectedPrompt, setSelectedPrompt] = useState<HitlPrompt | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  // nowMs sai de estado (lazy init, não Date.now() em render — regra
  // react-hooks/purity); o intervalo faz o "tempo parado" avançar.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const { data, loading, unavailable, error, refetch } = useCoordinationPoll(
    () => fetchTasks(""),
    [],
  );
  const { data: hitlData, refetch: refetchHitl } = useCoordinationPoll(
    fetchHitlPending,
    [],
  );

  const prompts = useMemo(() => hitlData?.prompts ?? [], [hitlData]);
  const promptsByRef = useMemo(() => {
    const m = new Map<string, HitlPrompt[]>();
    for (const p of prompts) {
      if (!p.source_ref) continue;
      const l = m.get(p.source_ref) ?? [];
      l.push(p);
      m.set(p.source_ref, l);
    }
    return m;
  }, [prompts]);

  const groups = useMemo(
    () => groupAndSortTasks(data?.tasks ?? [], prompts),
    [data, prompts],
  );

  // Prompts sem task casada na lista atual — não podem sumir (brecha HITL).
  const orphanPrompts = useMemo(() => {
    const refs = new Set((data?.tasks ?? []).map((t) => t.source_ref));
    return prompts.filter((p) => !p.source_ref || !refs.has(p.source_ref));
  }, [prompts, data]);

  const handleAnswer = async (id: number, answer: HitlAnswerValue) => {
    await answerHitl(id, answer);
    await refetchHitl();
    await refetch();
  };

  const openPrompt = (t: CoordTask) => {
    const p0 = promptsByRef.get(t.source_ref)?.[0];
    if (p0) setSelectedPrompt(p0);
  };

  const onSkip = async (ref: string) => {
    await setTaskPriority(ref, "bottom");
    await refetch();
  };
  const onRetry = async (ref: string) => {
    await setTaskPriority(ref, "top");
    await refetch();
  };
  const toggleSel = (ref: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(ref)) n.delete(ref);
      else n.add(ref);
      return n;
    });
  const selectAllNeedYou = (refs: string[], on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const r of refs) {
        if (on) n.add(r);
        else n.delete(r);
      }
      return n;
    });
  const onBatchApprove = async () => {
    const sel = (data?.tasks ?? []).filter((t) => selected.has(t.source_ref));
    const ps = sel.flatMap((t) => promptsByRef.get(t.source_ref) ?? []);
    const plan = batchApprovals(ps);
    for (const a of plan.approvable) await answerHitl(a.id, a.answer);
    setSelected(new Set());
    await refetchHitl();
    await refetch();
  };
  const onBatchSkip = async () => {
    for (const ref of Array.from(selected)) await setTaskPriority(ref, "bottom");
    setSelected(new Set());
    await refetch();
  };

  const renderRow = (t: CoordTask) => {
    const status = deriveStatus(t, prompts);
    const stuck = formatStuckTime(stuckSince(t, status), nowMs, DEFAULT_SLA_MS);
    const am = agentModel(t, status);
    const hasPrompt = (promptsByRef.get(t.source_ref)?.length ?? 0) > 0;
    return (
      <div
        key={t.source_ref}
        className="flex items-center gap-3 px-3 py-3 border-t border-slate-900 hover:bg-slate-900/40"
      >
        {statusGroup(status) === "need_you" && (
          <input
            type="checkbox"
            className="w-4 h-4 shrink-0"
            checked={selected.has(t.source_ref)}
            onChange={() => toggleSel(t.source_ref)}
          />
        )}
        <div className="font-mono font-bold text-base w-16 shrink-0">
          #{t.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate">{t.title ?? "—"}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {t.project ?? "—"}
            {am && <span> · {am}</span>}
            {status === "error" && t.run_status && (
              <span className="text-rose-400/80"> · {t.run_status}</span>
            )}
          </div>
        </div>
        <div className={`text-sm font-bold w-44 shrink-0 ${STATUS_COLOR[status]}`}>
          {tr(`tasks.status.${status}` as TranslationKey)}
          {stuck.label && (
            <span
              className={stuck.overdue ? "text-rose-400 ml-1" : "text-slate-500 ml-1"}
            >
              {" "}
              · {stuck.label}
              {stuck.overdue ? " 🔴" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status === "pending" && hasPrompt && (
            <button
              onClick={() => openPrompt(t)}
              className="px-3 py-1.5 rounded text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
            >
              {tr("tasks.see")}
            </button>
          )}
          {status === "pending" && (
            <button
              onClick={() => void onSkip(t.source_ref)}
              className="px-3 py-1.5 rounded text-sm font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
            >
              ⤓ {tr("tasks.skip")}
            </button>
          )}
          {status === "error" && (
            <button
              onClick={() => void onRetry(t.source_ref)}
              className="px-3 py-1.5 rounded text-sm font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30"
            >
              ↻ {tr("tasks.retry")}
            </button>
          )}
          {t.url && (
            <a
              href={t.url}
              target="_blank"
              rel="noreferrer"
              title={tr("tasks.openIssue")}
              className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <GithubMark size={18} />
            </a>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (
    titleKey: TranslationKey,
    tasks: CoordTask[],
    accent: string,
    batch = false,
  ) => {
    const refs = tasks.map((t) => t.source_ref);
    const selCount = refs.filter((r) => selected.has(r)).length;
    const allSel = refs.length > 0 && selCount === refs.length;
    return (
      <section className="mb-5">
        <h2 className={`text-sm font-extrabold tracking-wide mb-1 ${accent}`}>
          {tr(titleKey)} — {tasks.length}
        </h2>
        {batch && tasks.length > 0 && (
          <div className="flex items-center gap-2 mb-2 flex-wrap text-sm">
            <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={allSel}
                onChange={(e) => selectAllNeedYou(refs, e.target.checked)}
              />
              {tr("tasks.selectAll")}
            </label>
            <button
              disabled={selCount === 0}
              onClick={() => void onBatchApprove()}
              className="px-3 py-1.5 rounded font-bold bg-emerald-600 text-white disabled:opacity-40"
            >
              ✓ {tr("tasks.batchApprove")}
            </button>
            <button
              disabled={selCount === 0}
              onClick={() => void onBatchSkip()}
              className="px-3 py-1.5 rounded font-bold bg-slate-700 text-slate-100 disabled:opacity-40"
            >
              ⤓ {tr("tasks.batchSkip")}
            </button>
            {selCount > 0 && (
              <span className="text-slate-500">{selCount} selecionada(s)</span>
            )}
          </div>
        )}
        <div className="border border-slate-800 rounded-lg overflow-hidden">
          {tasks.length === 0 ? (
            <p className="px-3 py-4 text-slate-600 text-sm">{tr("tasks.empty")}</p>
          ) : (
            tasks.map(renderRow)
          )}
        </div>
      </section>
    );
  };

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

      <div className="mb-3 flex items-center justify-between gap-2">
        <CreateTaskForm onCreated={() => void refetch()} />
        <button
          onClick={() => void refetch()}
          className="flex items-center gap-1 px-3 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded text-sm font-bold transition-colors shrink-0"
        >
          <RefreshCw size={14} /> Atualizar
        </button>
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
        <>
          {renderGroup("tasks.group.needYou", groups.need_you, "text-amber-400", true)}
          {renderGroup(
            "tasks.group.inProgress",
            groups.in_progress,
            "text-sky-400",
          )}
          {renderGroup("tasks.group.queue", groups.queue, "text-slate-400")}
        </>
      )}

      {orphanPrompts.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-bold text-slate-300 mb-2">
            {tr("hitl.noIssueSection")}
          </h2>
          <ul className="flex flex-col gap-2">
            {orphanPrompts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between border border-slate-800 rounded px-3 py-2"
              >
                <span className="truncate">
                  {p.source_ref && (
                    <span className="font-mono text-slate-500 mr-2">
                      {p.source_ref}
                    </span>
                  )}
                  {p.question}
                </span>
                <button
                  onClick={() => setSelectedPrompt(p)}
                  className="ml-3 px-3 py-1 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded hover:bg-amber-500/30"
                >
                  {tr("hitl.open")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <HitlAnswerModal
        key={selectedPrompt?.id ?? "none"}
        prompt={selectedPrompt}
        onClose={() => setSelectedPrompt(null)}
        onSubmit={handleAnswer}
      />
    </main>
  );
}
