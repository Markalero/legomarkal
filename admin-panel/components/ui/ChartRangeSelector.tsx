"use client";
import { useId } from "react";

type RangeKey = "1m" | "3m" | "6m" | "all";

interface Props {
  value?: RangeKey;
  onChange?: (v: RangeKey) => void;
}

const LABELS: Record<RangeKey, string> = {
  "1m": "Último mes",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  all: "Desde siempre",
};

export function ChartRangeSelector({ value = "6m", onChange }: Props) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-2" role="radiogroup" aria-label="Rango temporal de la grafica">
      {(["1m", "3m", "6m", "all"] as RangeKey[]).map((k) => (
        <button
          key={k}
          id={`${id}-${k}`}
          type="button"
          role="radio"
          aria-checked={value === k}
          aria-label={LABELS[k]}
          onClick={() => onChange?.(k)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            value === k
              ? "bg-bg-elevated border border-border text-text-primary"
              : "bg-transparent text-text-muted hover:bg-bg-elevated/40"
          }`}
        >
          {LABELS[k]}
        </button>
      ))}
    </div>
  );
}

export type { RangeKey };
