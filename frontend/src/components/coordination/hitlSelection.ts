import type { HitlPrompt } from "./coordinationApi";

export interface HitlSelection {
  choice: string;
  multi: string[];
}

/** Seleção inicial do modal a partir da opção recomendada pelo agente. */
export function initialSelection(prompt: HitlPrompt | null): HitlSelection {
  const empty: HitlSelection = { choice: "", multi: [] };
  if (!prompt || !prompt.recommended_key) return empty;
  const keys = new Set((prompt.options ?? []).map((o) => o.key));
  if (!keys.has(prompt.recommended_key)) return empty;
  if (prompt.kind === "choice")
    return { choice: prompt.recommended_key, multi: [] };
  if (prompt.kind === "multi")
    return { choice: "", multi: [prompt.recommended_key] };
  return empty;
}
