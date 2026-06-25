import type React from "react";

/** Chips discretos das labels da issue na lista de tasks (área, disposição, fila
 *  etc.). Mostra as labels que já vêm no objeto task; trunca com "+N" acima de
 *  `max` pra não estourar a linha. Estilo neutro (borda translúcida) pra cair bem
 *  tanto no /tasks (slate) quanto no dashboard (neon). */
export function TaskLabels({
  labels,
  max = 6,
  className = "",
}: {
  labels: string[];
  max?: number;
  className?: string;
}): React.ReactNode {
  if (labels.length === 0) return null;
  const visible = labels.slice(0, max);
  const extra = labels.length - visible.length;
  return (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {visible.map((l) => (
        <span
          key={l}
          className="text-[10px] leading-none px-1.5 py-0.5 rounded border border-white/15 text-slate-400 whitespace-nowrap"
        >
          {l}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="text-[10px] leading-none px-1.5 py-0.5 rounded border border-white/10 text-slate-500 whitespace-nowrap"
          title={labels.slice(max).join(", ")}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
