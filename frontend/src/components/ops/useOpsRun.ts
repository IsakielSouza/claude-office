"use client";

import { useState } from "react";

import { runDeploy } from "./opsApi";

export function useOpsRun() {
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const start = async (destId: string, dryRun: boolean): Promise<boolean> => {
    setRunning(true);
    setMsg(null);
    try {
      const r = await runDeploy(destId, dryRun);
      if (r.alreadyRunning) {
        setMsg("já tem um deploy em andamento");
        return false;
      }
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "erro ao iniciar");
      return false;
    } finally {
      setRunning(false);
    }
  };

  return { start, running, msg };
}
