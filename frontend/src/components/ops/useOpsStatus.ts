"use client";

import { useCallback, useEffect, useState } from "react";

import { type OpsStatus, getStatus } from "./opsApi";

export function useOpsStatus() {
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
  }, [refresh]);

  return { status, refresh };
}
