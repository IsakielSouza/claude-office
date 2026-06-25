"use client";

import type { Destination } from "./opsApi";

/**
 * Seletor (apresentacional) de destino de deploy. Lista apenas os destinos
 * habilitados e expõe um botão para abrir o gerenciador. Sem fetch — props in,
 * callbacks out (o container OpsPanel injeta os dados/hooks).
 */
export function DestinationSelect({
  items,
  value,
  onChange,
  onManage,
  disabled,
}: {
  items: Destination[];
  value: string | null;
  onChange: (id: string) => void;
  onManage: () => void;
  disabled?: boolean;
}): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      <select
        className="bg-slate-800 text-slate-100 text-sm rounded px-3 py-2 border border-slate-700"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {items
          .filter((d) => d.enabled)
          .map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
      </select>
      <button
        className="text-sm text-slate-400 hover:text-sky-400 disabled:opacity-40"
        onClick={onManage}
        disabled={disabled}
        title="Gerenciar destinos"
      >
        ⚙ Gerenciar
      </button>
    </div>
  );
}
