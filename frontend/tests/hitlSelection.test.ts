import { describe, it, expect } from "vitest";
import type { HitlPrompt } from "../src/components/coordination/coordinationApi";
import { initialSelection } from "../src/components/coordination/hitlSelection";

const prompt = (over: Partial<HitlPrompt>): HitlPrompt => ({
  id: 1,
  source_ref: null,
  session_id: null,
  agent: null,
  project: null,
  question: "q",
  context: null,
  kind: "choice",
  options: [
    { key: "A", label: "x" },
    { key: "B", label: "y" },
  ],
  recommended_key: null,
  status: "pending",
  answer: null,
  created_at: "2026-06-01T00:00:00Z",
  expires_at: null,
  issue_title: null,
  issue_url: null,
  ...over,
});

describe("initialSelection", () => {
  it("null → vazio", () => {
    expect(initialSelection(null)).toEqual({ choice: "", multi: [] });
  });
  it("choice com recomendada válida → pré-seleciona", () => {
    expect(
      initialSelection(prompt({ kind: "choice", recommended_key: "B" })),
    ).toEqual({ choice: "B", multi: [] });
  });
  it("choice sem recomendada → vazio", () => {
    expect(
      initialSelection(prompt({ kind: "choice", recommended_key: null })),
    ).toEqual({ choice: "", multi: [] });
  });
  it("recomendada fora das options → ignora", () => {
    expect(
      initialSelection(prompt({ kind: "choice", recommended_key: "Z" })),
    ).toEqual({ choice: "", multi: [] });
  });
  it("multi com recomendada válida → pré-marca uma", () => {
    expect(
      initialSelection(prompt({ kind: "multi", recommended_key: "A" })),
    ).toEqual({ choice: "", multi: ["A"] });
  });
  it("yesno/text → vazio", () => {
    expect(
      initialSelection(
        prompt({ kind: "yesno", options: null, recommended_key: "A" }),
      ),
    ).toEqual({ choice: "", multi: [] });
    expect(initialSelection(prompt({ kind: "text", options: null }))).toEqual({
      choice: "",
      multi: [],
    });
  });
});
