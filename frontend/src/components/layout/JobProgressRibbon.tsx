"use client";

import { CheckCircle, Loader2, X, XCircle } from "lucide-react";
import { useJobStore } from "@/stores/jobStore";

export function JobProgressRibbon(): React.ReactNode {
  const job = useJobStore((s) => s.job);
  const clearJob = useJobStore((s) => s.clearJob);

  if (!job) return null;

  const isDone = job.status === "done";
  const isFailed = job.status === "failed";
  const isRunning = job.status === "running";

  const barColor = isDone
    ? "bg-emerald-500"
    : isFailed
      ? "bg-neutral-700"
      : "bg-slate-500";

  const icon = isDone ? (
    <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
  ) : isFailed ? (
    <XCircle size={14} className="text-red-400 flex-shrink-0" />
  ) : (
    <Loader2 size={14} className="text-slate-400 animate-spin flex-shrink-0" />
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-neutral-950">
      {/* barra de progresso */}
      <div className="h-0.5 w-full bg-slate-800">
        <div
          className={`h-full transition-all duration-300 ease-out ${barColor}`}
          style={{ width: `${job.progress}%` }}
        />
      </div>

      {/* conteúdo */}
      <div className="flex items-center gap-3 px-4 py-2">
        {icon}

        <div className="flex-1 min-w-0">
          <span className="text-xs text-slate-400 truncate">
            <span className="font-medium text-slate-300">{job.agentNome}</span>
            {" · "}
            {job.functionLabel}
          </span>
          <span className="ml-2 text-xs text-slate-500">{job.message}</span>
        </div>

        {isRunning && (
          <span className="text-xs text-slate-500 flex-shrink-0 tabular-nums">
            {job.progress}%
          </span>
        )}

        {(isDone || isFailed) && (
          <span
            className={`text-xs flex-shrink-0 font-medium ${isDone ? "text-emerald-400" : "text-red-400"}`}
          >
            {isDone ? "Completo" : "Falhou"}
          </span>
        )}

        {(isDone || isFailed) && (
          <button
            onClick={clearJob}
            aria-label="Fechar"
            className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
