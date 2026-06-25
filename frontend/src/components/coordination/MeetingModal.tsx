"use client";

import { useEffect, useRef, useState } from "react";
import Modal from "@/components/overlay/Modal";
import {
  createMeeting,
  fetchHitlPrompt,
  type CoordAgent,
  type HitlPrompt,
} from "./coordinationApi";

/**
 * Reunião CEO→agente (#547). O CEO clica num agente no mapa do cockpit e abre este
 * modal; ao enviar, cria um hitl_prompt DIRECIONADO (POST /meeting). Como os agentes
 * rodam headless (`claude -p`, sem chat síncrono), não há resposta em tempo real: o
 * agente lê a reunião no início do próximo ciclo (`hitl.py inbox`) e responde em
 * FOREGROUND (`hitl.py reply`). Este modal faz POLL do prompt (GET /hitl/{id}) e
 * mostra a resposta quando ela chega (status=answered). Ponte HITL ("Opção B").
 */
const POLL_MS = 4000;

function answerText(answer: HitlPrompt["answer"]): string {
  if (answer == null) return "";
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer);
}

export default function MeetingModal({
  agent,
  onClose,
}: {
  agent: CoordAgent | null;
  onClose: () => void;
}): React.ReactNode {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<HitlPrompt | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // O modal é remontado por `key={agent.nome}` no OfficeMap, então o estado nasce
  // fresh a cada agente — sem necessidade de reset via effect.

  // Poll do prompt criado até o agente responder (pending→answered/expired).
  useEffect(() => {
    if (!prompt || prompt.status !== "pending") return;
    const id = prompt.id;
    pollTimer.current = setInterval(() => {
      void fetchHitlPrompt(id)
        .then((r) => setPrompt(r.prompt))
        .catch(() => {
          /* mantém o último estado; tenta de novo no próximo tick */
        });
    }, POLL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [prompt]);

  if (!agent) return null;

  async function submit(): Promise<void> {
    if (!agent) return;
    const msg = message.trim();
    if (!msg) {
      setError("escreva uma mensagem");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await createMeeting({
        agent: agent.nome,
        message: msg,
        project: agent.projetos[0],
      });
      setPrompt(r.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setSubmitting(false);
    }
  }

  const sent = prompt !== null;
  const answered = prompt?.status === "answered";
  const expired = prompt?.status === "expired";

  const footer = !sent ? (
    <button
      disabled={submitting || message.trim() === ""}
      onClick={() => void submit()}
      className="px-4 py-2 rounded text-sm font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 disabled:opacity-40"
    >
      {submitting ? "Enviando…" : "Enviar reunião"}
    </button>
  ) : (
    <button
      onClick={onClose}
      className="px-4 py-2 rounded text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200"
    >
      Fechar
    </button>
  );

  return (
    <Modal
      isOpen={agent !== null}
      onClose={onClose}
      title={`Reunião com ${agent.nome}`}
      footer={footer}
    >
      <p className="mb-3 text-xs text-slate-500 font-mono">
        {agent.role}
        {agent.projetos[0] && ` · ${agent.projetos[0]}`}
      </p>

      {!sent && (
        <>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            autoFocus
            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
            placeholder="O que você quer perguntar/pedir a este agente?"
          />
          <p className="mt-2 text-xs text-slate-500">
            O agente roda headless — ele lerá esta reunião no início do próximo
            ciclo e responderá então (não é chat em tempo real).
          </p>
        </>
      )}

      {sent && (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 font-mono mb-1">
              Sua mensagem
            </div>
            <p className="text-slate-300 whitespace-pre-wrap bg-slate-950 border border-slate-800 rounded p-2 text-sm">
              {prompt?.question}
            </p>
          </div>

          {answered ? (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-emerald-400 font-mono mb-1">
                Resposta de {agent.nome}
              </div>
              <p className="text-emerald-200 whitespace-pre-wrap bg-emerald-500/5 border border-emerald-500/30 rounded p-2 text-sm">
                {answerText(prompt?.answer ?? null) || "(sem texto)"}
              </p>
            </div>
          ) : expired ? (
            <p className="text-rose-400 text-sm">
              A reunião expirou sem resposta (24h). Reabra para tentar de novo.
            </p>
          ) : (
            <p className="flex items-center gap-2 text-amber-300 text-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 inline-block animate-pulse" />
              Aguardando {agent.nome} ler no próximo ciclo…
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-rose-400 text-xs">{error}</p>}
    </Modal>
  );
}
