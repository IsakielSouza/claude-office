"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy } from "lucide-react";
import { CoordinationNav } from "@/components/coordination/CoordinationNav";

// Página de referência: como iniciar agentes. Foco = tabela por-agente com o
// comando exato e o path, cada um com botão de copiar (copia → cola no terminal).

const ROSTER: { nome: string; funcao: string; path: string }[] = [
  {
    nome: "OFFICE-MANAGER-1",
    funcao: "gerente / coordenador (#368)",
    path: "hmtrack-documentacao/Agents/gerente",
  },
  {
    nome: "TRIADOR-1",
    funcao: "triagem de issues",
    path: "hmtrack-documentacao/Agents/triador",
  },
  { nome: "DEV-FRONT-1", funcao: "frontend", path: "hmtrack-front" },
  { nome: "DEV-API-1", funcao: "API Python", path: "hmtrack-api-py" },
  {
    nome: "DEV-TRACKERS-1",
    funcao: "rastreadores GPS",
    path: "hmtrack-trackers",
  },
  {
    nome: "DEV-ALERT-1",
    funcao: "sistema de alertas",
    path: "hmtrack-alert-system",
  },
  {
    nome: "DBA-1",
    funcao: "banco de dados",
    path: "hmtrack-documentacao/BANCO-DADOS",
  },
];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={`copiar: ${text}`}
      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border transition-colors ${
        copied
          ? "border-[#4ade80]/40 text-[#4ade80] bg-[#4ade80]/10"
          : "border-[#2e3653] bg-[#131826] text-[#7e89a3] hover:text-[#c7d0e0]"
      }`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "copiado" : "copiar"}
    </button>
  );
}

export default function AjudaPage(): React.ReactNode {
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

      <div className="max-w-4xl space-y-4">
        <p className="text-sm text-[#7e89a3]">
          Iniciar um agente: clique em <b>copiar</b> na linha dele, abra um
          terminal e cole. O comando já entra no repo certo e carimba a
          identidade no cockpit (ele aparece como mesa).
        </p>

        {/* Tabela por-agente: comando + função + path + copiar */}
        <div className="border border-[#232a40] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#131826] text-[#7e89a3] text-left text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 font-bold">Agente</th>
                <th className="px-3 py-2 font-bold">Comando</th>
                <th className="px-3 py-2 font-bold">Abre em</th>
                <th className="px-3 py-2 font-bold w-px"></th>
              </tr>
            </thead>
            <tbody>
              {ROSTER.map((a) => {
                const cmd = `start-agent ${a.nome}`;
                return (
                  <tr
                    key={a.nome}
                    className="border-t border-[#232a40] hover:bg-[#131826]/60"
                  >
                    <td className="px-3 py-2">
                      <div className="font-mono text-[#c7d0e0]">{a.nome}</div>
                      <div className="text-[11px] text-[#4b5573]">
                        {a.funcao}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <code className="text-[13px] font-mono text-[#4ade80]">
                        {cmd}
                      </code>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[#7e89a3]">
                      {a.path}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <CopyBtn text={cmd} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Notas rápidas */}
        <div className="border border-[#232a40] rounded-lg bg-[#131826] p-4 space-y-2 text-sm text-[#c7d0e0]">
          <div className="text-xs uppercase tracking-wide text-[#7e89a3] font-bold mb-1">
            Notas
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#7e89a3]">1ª vez (ativar aliases):</span>
            <code className="font-mono text-[#4ade80]">source ~/.bashrc</code>
            <CopyBtn text="source ~/.bashrc" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#7e89a3]">Atalho do gerente (#368):</span>
            <code className="font-mono text-[#4ade80]">gerente-boss</code>
            <span className="text-[#4b5573] text-xs">
              = start-agent OFFICE-MANAGER-1
            </span>
            <CopyBtn text="gerente-boss" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#7e89a3]">Ver/conferir sem abrir:</span>
            <code className="font-mono text-[#4ade80]">
              start-agent DEV-API-1 --print
            </code>
            <span className="text-[#4b5573] text-xs">
              · one-off: --task &quot;...&quot;
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#7e89a3]">Subir este cockpit:</span>
            <code className="font-mono text-[#4ade80]">claude-office</code>
            <span className="text-[#4b5573] text-xs">
              → http://localhost:5000
            </span>
            <CopyBtn text="claude-office" />
          </div>
        </div>
      </div>
    </main>
  );
}
