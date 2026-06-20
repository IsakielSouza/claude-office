"use client";

import { useEffect, useRef } from "react";

// Sequências ANSI/CSI (cores, cursor) emitidas pelo build-push (`\x1b[1;36m`).
// Removidas na exibição para o log não mostrar escapes crus. O `\x1b` (ESC) é
// obrigatório no padrão — sem ele, texto comum como `[INFO]` seria corrompido.
const ANSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g;

/** Remove sequências de escape ANSI de uma linha de log. */
export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

/**
 * Painel de log de deploy (apresentacional). Auto-scroll para o fim a cada nova
 * linha, fonte mono e um badge de estado (em andamento / concluído / falhou).
 * Sem fetch — recebe `lines`/`step`/`result` via props.
 */
export function OpsLogPanel({
  lines,
  step,
  result,
}: {
  lines: string[];
  step: string;
  result: { status: string; exit_code: number } | null;
}): React.ReactNode {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const badge = result
    ? result.status === "done"
      ? "✅ concluído"
      : `❌ falhou (exit ${result.exit_code})`
    : `▶ ${step}`;

  return (
    <div className="mt-4 border border-slate-700 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-slate-800 text-sm font-bold text-slate-200">
        {badge}
      </div>
      <pre className="bg-black/80 text-slate-200 text-xs p-3 h-96 overflow-auto font-mono whitespace-pre-wrap">
        {lines.map(stripAnsi).join("\n")}
        <div ref={endRef} />
      </pre>
    </div>
  );
}
