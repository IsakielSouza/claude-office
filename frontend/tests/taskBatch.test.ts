import { describe, it, expect } from "vitest";
import type { HitlPrompt } from "../src/components/coordination/coordinationApi";
import { batchApprovals } from "../src/components/coordination/taskBatch";

const p = (over: Partial<HitlPrompt>): HitlPrompt => ({
  id: 1,
  source_ref: null,
  session_id: null,
  agent: null,
  project: null,
  question: "q",
  context: null,
  kind: "yesno",
  options: null,
  recommended_key: null,
  status: "pending",
  answer: null,
  created_at: "2026-06-01T00:00:00Z",
  expires_at: null,
  issue_title: null,
  issue_url: null,
  ...over,
});

describe("batchApprovals", () => {
  it("yesno → answer true", () => {
    const r = batchApprovals([p({ id: 1, kind: "yesno" })]);
    expect(r.approvable).toEqual([{ id: 1, answer: true }]);
    expect(r.manual).toEqual([]);
  });
  it("choice com recomendada → answer a recomendada", () => {
    const r = batchApprovals([
      p({
        id: 2,
        kind: "choice",
        options: [{ key: "A", label: "x" }],
        recommended_key: "A",
      }),
    ]);
    expect(r.approvable).toEqual([{ id: 2, answer: "A" }]);
  });
  it("multi com recomendada → answer [recomendada]", () => {
    const r = batchApprovals([
      p({
        id: 3,
        kind: "multi",
        options: [{ key: "A", label: "x" }],
        recommended_key: "A",
      }),
    ]);
    expect(r.approvable).toEqual([{ id: 3, answer: ["A"] }]);
  });
  it("choice sem recomendada / text → manual (não auto-aprova)", () => {
    const r = batchApprovals([
      p({
        id: 4,
        kind: "choice",
        options: [{ key: "A", label: "x" }],
        recommended_key: null,
      }),
      p({ id: 5, kind: "text" }),
    ]);
    expect(r.approvable).toEqual([]);
    expect(r.manual).toEqual([4, 5]);
  });
});
