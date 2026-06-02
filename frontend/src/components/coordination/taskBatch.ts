import type { HitlPrompt, HitlAnswerValue } from "./coordinationApi";

export interface BatchPlan {
  approvable: { id: number; answer: HitlAnswerValue }[];
  manual: number[]; // ids que precisam de decisão individual
}

/** Quais prompts dá pra aprovar em lote (yesno→true; choice/multi→recomendada). */
export function batchApprovals(prompts: HitlPrompt[]): BatchPlan {
  const approvable: BatchPlan["approvable"] = [];
  const manual: number[] = [];
  for (const p of prompts) {
    if (p.kind === "yesno") {
      approvable.push({ id: p.id, answer: true });
    } else if ((p.kind === "choice" || p.kind === "multi") && p.recommended_key) {
      const keys = new Set((p.options ?? []).map((o) => o.key));
      if (keys.has(p.recommended_key)) {
        approvable.push({
          id: p.id,
          answer: p.kind === "multi" ? [p.recommended_key] : p.recommended_key,
        });
        continue;
      }
      manual.push(p.id);
    } else {
      manual.push(p.id);
    }
  }
  return { approvable, manual };
}
