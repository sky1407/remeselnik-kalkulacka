"use client";

import type { ReactNode } from "react";
import type { Quote } from "@/lib/calc/quote";
import { eur, num } from "@/lib/format";
import { useSettingsStore } from "@/lib/settings";

interface QuoteSummaryProps {
  quote: Quote;
  label: string;
  /** Text k odhadu hodín, napr. „fúkanie“ alebo „práca“. */
  hoursLabel: string;
  /** Detail nad položkami (napr. výpočet objemu celulózy). */
  details?: ReactNode;
}

/** Riadky ponuky a súčty s DPH podľa nastavení remeselníka – spoločné pre všetky remeslá. */
export function QuoteSummary({ quote, label, hoursLabel, details }: QuoteSummaryProps) {
  const vat = useSettingsStore((s) => s.vat);
  return (
    <section aria-label={label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
      {details}
      <ul className={`divide-y divide-stone-100 text-sm ${details ? "mt-2 border-t border-stone-200" : ""}`}>
        {quote.lines.map((l) => (
          <li key={`${l.kind}-${l.label}`} className="flex justify-between gap-3 py-2">
            <span className="text-stone-700">
              {l.label}
              <span className="block text-xs text-stone-500">
                {num.format(l.quantity)} {l.unit} × {eur.format(l.unitPrice)}
              </span>
            </span>
            <span className="font-semibold tabular-nums">{eur.format(l.totalCents / 100)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
        {vat.payer && (
          <>
            <div className="flex justify-between text-stone-600">
              <dt>Spolu bez DPH</dt>
              <dd className="tabular-nums">{eur.format(quote.netCents / 100)}</dd>
            </div>
            <div className="flex justify-between text-stone-600">
              <dt>DPH {Math.round(vat.rate * 100)} %</dt>
              <dd className="tabular-nums">{eur.format(quote.vatCents / 100)}</dd>
            </div>
          </>
        )}
        <div className="flex items-end justify-between">
          <dt className="text-stone-500">
            {vat.payer ? "Spolu s DPH" : "Spolu (neplatiteľ DPH)"} · {hoursLabel} {num.format(quote.laborHours)} h
          </dt>
          <dd className="text-2xl font-bold tabular-nums">{eur.format(quote.grossCents / 100)}</dd>
        </div>
      </dl>
    </section>
  );
}
