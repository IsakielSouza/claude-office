"use client";

import { useState } from "react";
import Modal from "@/components/overlay/Modal";
import { useTranslation } from "@/hooks/useTranslation";
import type {
  HitlPrompt,
  HitlAnswerValue,
} from "@/components/coordination/coordinationApi";

interface Props {
  prompt: HitlPrompt | null;
  onClose: () => void;
  onSubmit: (id: number, answer: HitlAnswerValue) => Promise<void>;
}

/** Modal de resposta a um prompt HITL. Renderiza o corpo conforme o `kind`. */
export default function HitlAnswerModal({ prompt, onClose, onSubmit }: Props) {
  const { t } = useTranslation();
  const [choice, setChoice] = useState<string>("");
  const [multi, setMulti] = useState<string[]>([]);
  const [textValue, setTextValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!prompt) return null;

  const toggleMulti = (key: string) =>
    setMulti((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const submit = async (value: HitlAnswerValue) => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(prompt.id, value);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    prompt.kind === "choice"
      ? choice !== ""
      : prompt.kind === "multi"
        ? multi.length > 0
        : prompt.kind === "text"
          ? textValue.trim() !== ""
          : true;

  const footer =
    prompt.kind === "yesno" ? (
      <>
        <button
          disabled={submitting}
          onClick={() => void submit(false)}
          className="px-4 py-2 rounded text-sm font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
        >
          {t("hitl.no")}
        </button>
        <button
          disabled={submitting}
          onClick={() => void submit(true)}
          className="px-4 py-2 rounded text-sm font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 disabled:opacity-40"
        >
          {t("hitl.yes")}
        </button>
      </>
    ) : (
      <button
        disabled={submitting || !canSubmit}
        onClick={() =>
          void submit(
            prompt.kind === "choice"
              ? choice
              : prompt.kind === "multi"
                ? multi
                : textValue,
          )
        }
        className="px-4 py-2 rounded text-sm font-bold bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 disabled:opacity-40"
      >
        {t("hitl.submit")}
      </button>
    );

  return (
    <Modal
      isOpen={prompt !== null}
      onClose={onClose}
      title={prompt.question}
      footer={footer}
    >
      {prompt.context && (
        <p className="mb-3 text-slate-400 whitespace-pre-wrap">
          {prompt.context}
        </p>
      )}
      {prompt.issue_url && (
        <a
          href={prompt.issue_url}
          target="_blank"
          rel="noreferrer"
          className="mb-3 block text-xs text-sky-400 hover:underline"
        >
          {prompt.source_ref ?? prompt.issue_title}
        </a>
      )}

      {prompt.kind === "choice" && (
        <div className="flex flex-col gap-2">
          {(prompt.options ?? []).map((o) => (
            <label
              key={o.key}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="hitl-choice"
                value={o.key}
                checked={choice === o.key}
                onChange={() => setChoice(o.key)}
              />
              <span>
                <strong>{o.key}</strong> — {o.label}
              </span>
            </label>
          ))}
        </div>
      )}

      {prompt.kind === "multi" && (
        <div className="flex flex-col gap-2">
          {(prompt.options ?? []).map((o) => (
            <label
              key={o.key}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={multi.includes(o.key)}
                onChange={() => toggleMulti(o.key)}
              />
              <span>
                <strong>{o.key}</strong> — {o.label}
              </span>
            </label>
          ))}
        </div>
      )}

      {prompt.kind === "text" && (
        <textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          rows={4}
          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
          placeholder={t("hitl.textPlaceholder")}
        />
      )}

      {error && <p className="mt-3 text-rose-400 text-xs">{error}</p>}
    </Modal>
  );
}
