"use client";

import { useId, useState, type ReactNode } from "react";
import { num } from "@/lib/format";

interface NumberFieldProps {
  label: string;
  /** Hodnota v základnej jednotke (m, podiel 0–1, €…). */
  value: number;
  /** Násobok pre zobrazenie – 1000 pre mm, 100 pre %. */
  scale?: number;
  /** Rozsah v zobrazovaných jednotkách. */
  min: number;
  max: number;
  unit: string;
  hint?: ReactNode;
  /** Upozornenie, ktoré neblokuje uloženie (napr. hustota mimo odporúčania). */
  warning?: string | null;
  onCommit: (value: number) => void;
}

/**
 * Číselné pole, ktoré pri písaní nič neorezáva – neplatný medzistav („1,“ alebo prázdne pole)
 * ostane v políčku s chybou a do výpočtu ide až platné číslo. Prijíma desatinnú čiarku aj bodku.
 */
export function NumberField({ label, value, scale = 1, min, max, unit, hint, warning, onCommit }: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const shown = Math.round(value * scale * 1000) / 1000;
  const parsed = draft === null ? shown : Number(draft.replace(",", ".").replace(/\s/g, ""));
  const error =
    draft !== null && (draft.trim() === "" || !Number.isFinite(parsed) || parsed < min || parsed > max)
      ? `Zadaj číslo od ${num.format(min)} do ${num.format(max)}`
      : null;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-stone-600">
        {label}
      </label>
      <div
        className={`flex h-12 items-center rounded-lg border bg-white pr-3 ${
          error ? "border-red-500" : warning ? "border-amber-500" : "border-stone-300"
        }`}
      >
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={draft ?? String(shown).replace(".", ",")}
          onFocus={(e) => {
            setDraft(String(shown).replace(".", ","));
            e.target.select();
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const v = Number(raw.replace(",", ".").replace(/\s/g, ""));
            if (raw.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) onCommit(v / scale);
          }}
          onBlur={() => setDraft(null)}
          aria-invalid={error !== null}
          aria-describedby={`${id}-msg`}
          className="h-full min-w-0 flex-1 rounded-lg bg-transparent px-3 text-lg font-semibold text-stone-900 outline-none"
        />
        <span className="shrink-0 text-sm text-stone-500">{unit}</span>
      </div>
      <p id={`${id}-msg`} className={`text-xs ${error ? "text-red-600" : warning ? "text-amber-700" : "text-stone-500"}`}>
        {error ?? warning ?? hint}
      </p>
    </div>
  );
}
