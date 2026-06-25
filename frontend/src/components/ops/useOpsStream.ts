"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Stream de eventos de ops/deploy.
 *
 * O backend (`OpsRunner._broadcast`) empurra mensagens `ops.*` via
 * `manager.broadcast_all`, que chegam no MESMO WebSocket de sessão consumido
 * por `useWebSocketEvents`. Aquele hook não expõe um `subscribe`/`lastMessage`
 * para tipos arbitrários — ele re-emite as mensagens não-reconhecidas como o
 * CustomEvent `ops-ws-message` no `window` (mesmo padrão do `session-deleted`
 * que já existia ali). Este hook só escuta esse evento; NÃO abre socket novo.
 */
export const OPS_WS_EVENT = "ops-ws-message";

export interface OpsMsg {
  type: string;
  run_id?: string;
  step?: string;
  line?: string;
  status?: string;
  exit_code?: number;
}

/** Guard puro (independente de React) — seam estável e testável. */
export function isOpsMessage(m: unknown): m is OpsMsg {
  const t = (m as { type?: unknown } | null)?.type;
  return typeof t === "string" && t.startsWith("ops.");
}

export interface OpsResult {
  status: string;
  exit_code: number;
}

export interface OpsStream {
  lines: string[];
  step: string;
  result: OpsResult | null;
  reset(): void;
  seed(tail: string[]): void;
}

export function useOpsStream(): OpsStream {
  const [lines, setLines] = useState<string[]>([]);
  const [step, setStep] = useState<string>("");
  const [result, setResult] = useState<OpsResult | null>(null);

  const reset = useCallback(() => {
    setLines([]);
    setStep("");
    setResult(null);
  }, []);

  const seed = useCallback((tail: string[]) => {
    setLines(tail);
  }, []);

  useEffect(() => {
    const handle = (e: Event): void => {
      const msg = (e as CustomEvent<unknown>).detail;
      if (!isOpsMessage(msg)) return;
      switch (msg.type) {
        case "ops.log":
          if (typeof msg.line === "string") {
            const line = msg.line;
            setLines((prev) => [...prev, line]);
          }
          break;
        case "ops.step":
          if (typeof msg.step === "string") setStep(msg.step);
          break;
        case "ops.result":
          setResult({
            status: msg.status ?? "",
            exit_code: msg.exit_code ?? 0,
          });
          break;
      }
    };
    window.addEventListener(OPS_WS_EVENT, handle);
    return () => window.removeEventListener(OPS_WS_EVENT, handle);
  }, []);

  return { lines, step, result, reset, seed };
}
