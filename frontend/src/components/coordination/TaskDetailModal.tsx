"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/overlay/Modal";
import { useTranslation, type TranslationKey } from "@/hooks/useTranslation";
import {
  fetchTaskDetail,
  addTaskNote,
  assignArea,
  respondTask,
  type CoordTask,
  type TaskDetail,
} from "@/components/coordination/coordinationApi";
import type { TaskStatus } from "@/components/coordination/taskStatus";

/** Opção do dropdown "Atribuir dono": área curta + agentes do roster que a cobrem. */
export interface AreaOption {
  area: string;
  agents: string[];
}

interface Props {
  task: CoordTask | null;
  status: TaskStatus;
  agentModel: string;
  /** Áreas atribuíveis, derivadas do roster vivo (`data.agents`) — sem hardcode. */
  areaOptions: AreaOption[];
  onClose: () => void;
  onApprove: (ref: string) => void; // relabel hitl→afk
  onSkip: (ref: string) => void;
  onRetry: (ref: string) => void;
  /** Atribuição/resposta mexeu nas labels da issue → o pai re-sincroniza a lista. */
  onChanged?: () => void;
}

/** Modal de detalhes: corpo da issue (fetch ao vivo) + notas do CEO pro agente +
 *  ações diretas. Remonta por task (key na página) → estado/fetch frescos. */
export default function TaskDetailModal({
  task,
  status,
  agentModel,
  areaOptions,
  onClose,
  onApprove,
  onSkip,
  onRetry,
  onChanged,
}: Props): React.ReactNode {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Atribuir dono (#840): área escolhida no dropdown + estado da aplicação.
  const [area, setArea] = useState("");
  const [assigning, setAssigning] = useState(false);
  // Responder task (#840): comentário pro agente (vira comment na issue + relabel).
  const [respText, setRespText] = useState("");
  const [responding, setResponding] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const ref = task?.source_ref ?? null;
  // `hitl` label-only (sem prompt no banco — esses abrem o HitlAnswerModal): a
  // resposta relabela hitl→afk; demais tipos só comentam (sem mexer no fluxo).
  const isHitl = task?.labels.includes("hitl") ?? false;

  useEffect(() => {
    if (!ref) return;
    let alive = true;
    fetchTaskDetail(ref)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setErr("falha ao carregar detalhes"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [ref]);

  if (!task) return null;

  const reload = () => {
    if (ref)
      void fetchTaskDetail(ref)
        .then(setDetail)
        .catch(() => {});
  };

  const sendNote = async () => {
    const txt = noteText.trim();
    if (!txt || !ref) return;
    setSending(true);
    setErr(null);
    try {
      await addTaskNote(ref, txt);
      setNoteText("");
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro ao enviar nota");
    } finally {
      setSending(false);
    }
  };

  // Aplicar área → issue ganha `area:<x>`+`afk` (sai de Sem dono/Sem agente). O pai
  // re-sincroniza (onChanged); fechamos o modal pra a task sumir do grupo na hora.
  const applyArea = async () => {
    if (!area || !ref) return;
    setAssigning(true);
    setErr(null);
    try {
      await assignArea(ref, area);
      setOkMsg(t("tasks.assignDone"));
      onChanged?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro ao atribuir área");
    } finally {
      setAssigning(false);
    }
  };

  // Responder: posta a resposta como comentário na issue (o dev-loop lê). Para
  // `hitl` label-only relabela hitl→afk (libera o fluxo); demais só comentam.
  const sendRespond = async () => {
    const txt = respText.trim();
    if (!txt || !ref) return;
    setResponding(true);
    setErr(null);
    try {
      await respondTask(ref, txt, isHitl); // relabel hitl→afk só p/ HITL
      setRespText("");
      setOkMsg(t("tasks.respondDone"));
      onChanged?.();
      if (isHitl) onClose();
      else reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "erro ao responder");
    } finally {
      setResponding(false);
    }
  };

  const isPendingLabel = status === "pending";
  const isError = status === "error";

  const footer = (
    <>
      {isPendingLabel && (
        <button
          onClick={() => {
            onApprove(task.source_ref);
            onClose();
          }}
          className="px-4 py-2 rounded text-sm font-bold bg-emerald-600 text-white"
        >
          ✓ {t("tasks.approve")}
        </button>
      )}
      {isError && (
        <button
          onClick={() => {
            onRetry(task.source_ref);
            onClose();
          }}
          className="px-4 py-2 rounded text-sm font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40"
        >
          ↻ {t("tasks.retry")}
        </button>
      )}
      <button
        onClick={() => {
          onSkip(task.source_ref);
          onClose();
        }}
        className="px-4 py-2 rounded text-sm font-bold bg-slate-800 text-slate-200 border border-slate-700"
      >
        ⤓ {t("tasks.skip")}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={task !== null}
      onClose={onClose}
      title={`#${task.number} — ${task.title ?? ""}`}
      footer={footer}
    >
      <div className="text-sm text-slate-300 mb-1 font-bold">
        {t(`tasks.status.${status}` as TranslationKey)}
      </div>
      <div className="text-sm text-slate-400 mb-2">
        {task.project ?? "—"}
        {agentModel && <span> · {agentModel}</span>}
      </div>
      {isError && task.run_status && (
        <div className="mb-2 text-sm text-rose-400">
          {t("tasks.status.error")}: {task.run_status}
        </div>
      )}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.labels.map((l) => (
            <span
              key={l}
              className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 border border-slate-700"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      {/* Corpo da issue (fetch ao vivo) */}
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
        {t("tasks.issueBody")}
      </div>
      <div className="mb-4 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm text-slate-300 bg-slate-950 border border-slate-800 rounded p-3">
        {loading ? (
          <span className="text-slate-600">{t("tasks.processing")}</span>
        ) : detail?.body ? (
          detail.body
        ) : (
          <span className="text-slate-600">{t("tasks.noBody")}</span>
        )}
      </div>

      {/* Atribuir dono (#840): dropdown de áreas com o agente que cobre cada uma
          (derivado do roster vivo) → Aplicar adiciona area:*+afk na issue. */}
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
        {t("tasks.assignOwnerTitle")}
      </div>
      <div className="mb-4 flex items-center gap-2">
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          disabled={assigning || areaOptions.length === 0}
          className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-sm disabled:opacity-40"
        >
          <option value="">
            {areaOptions.length === 0
              ? t("tasks.assignNoAreas")
              : t("tasks.assignAreaPlaceholder")}
          </option>
          {areaOptions.map((o) => (
            <option key={o.area} value={o.area}>
              area:{o.area}
              {o.agents.length > 0
                ? ` — ${o.agents.join(", ")}`
                : ` — ${t("tasks.assignNoAgent")}`}
            </option>
          ))}
        </select>
        <button
          disabled={assigning || !area}
          onClick={() => void applyArea()}
          className="px-3 py-1.5 rounded text-sm font-bold bg-fuchsia-600 text-white disabled:opacity-40"
        >
          {assigning ? t("tasks.processing") : t("tasks.assignApply")}
        </button>
      </div>

      {/* Responder task (#840): comentário pro agente (vira comment na issue). Para
          issues `hitl` label-only, relabela hitl→afk (libera o fluxo). */}
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
        {t("tasks.respondTitle")}
      </div>
      <textarea
        value={respText}
        onChange={(e) => setRespText(e.target.value)}
        rows={2}
        placeholder={t("tasks.respondPlaceholder")}
        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
      />
      <div className="mt-2 mb-4">
        <button
          disabled={responding || !respText.trim()}
          onClick={() => void sendRespond()}
          className="px-3 py-1.5 rounded text-sm font-bold bg-amber-600 text-white disabled:opacity-40"
        >
          {responding ? t("tasks.processing") : t("tasks.respondSend")}
        </button>
      </div>

      {/* Notas do CEO pro agente */}
      <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
        {t("tasks.notesTitle")}
      </div>
      {detail && detail.notes.length > 0 && (
        <ul className="mb-2 flex flex-col gap-1">
          {detail.notes.map((n) => (
            <li
              key={n.id}
              className="text-sm bg-slate-900 border border-slate-800 rounded px-2 py-1"
            >
              <span className="text-slate-300">{n.note}</span>
              <span className="text-slate-600 text-xs ml-2">
                ({n.created_by}
                {n.consumed_at ? " · lida pelo agente" : " · aguardando"})
              </span>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        rows={2}
        placeholder={t("tasks.notePlaceholder")}
        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          disabled={sending || !noteText.trim()}
          onClick={() => void sendNote()}
          className="px-3 py-1.5 rounded text-sm font-bold bg-sky-600 text-white disabled:opacity-40"
        >
          {sending ? t("tasks.processing") : t("tasks.sendNote")}
        </button>
        {detail?.url && (
          <a
            href={detail.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-sky-400 hover:underline"
          >
            ↗ {t("tasks.openIssue")}
          </a>
        )}
      </div>
      {err && <p className="mt-2 text-rose-400 text-xs">{err}</p>}
      {okMsg && <p className="mt-2 text-emerald-400 text-xs">{okMsg}</p>}
    </Modal>
  );
}
