"use client";

import { useCallback, useEffect, useState } from "react";

import { type OpsStatus, getStatus } from "./opsApi";

/**
 * Status do runner de ops/deploy. Busca no mount e mantém um poll leve
 * (`intervalMs`, default 15s) para o badge `busy`/`step` não ficar stale caso
 * OUTRO cliente dispare um run — o WS (`useOpsStream`) só cobre o run conhecido
 * por este cliente. Mesma ideia de fallback do `useCoordinationPoll`.
 */
export function useOpsStatus(intervalMs = 15000) {
  const [status, setStatus] = useState<OpsStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getStatus());
    } catch {
      /* mantém último */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount via refresh()
    void refresh();
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { status, refresh };
}
