"use client";

import { useMemo } from "react";
import { calculateQuote } from "@/lib/calc/quote";
import { eur, num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { useHouseStore } from "@/lib/houseStore";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { celluloseFor, celluloseWorkItems, isCelluloseTarget } from "@/lib/trades/cellulose";

const DEFAULT_CELLULOSE = DEFAULT_SETTINGS.cellulose;

/** Výber plôch na zateplenie a priebežný výpočet celulózy s cenovou ponukou. */
export function CellulosePanel({ elements }: { elements: readonly BuildingElement[] }) {
  const selected = useHouseStore((s) => s.selected);
  const toggleElement = useHouseStore((s) => s.toggleElement);

  const targets = useMemo(() => elements.filter(isCelluloseTarget), [elements]);

  const { results, quote } = useMemo(() => {
    const results = targets.filter((el) => selected.includes(el.id)).map((el) => celluloseFor(el, DEFAULT_CELLULOSE));
    const items = celluloseWorkItems(results, DEFAULT_CELLULOSE);
    // Región, doprava a DPH pribudnú v nastaveniach – zatiaľ cena bez DPH.
    const quote = items.length
      ? calculateQuote({ items, regionCoefficient: 1, vatPayer: false, vatRate: 0.23 })
      : null;
    return { results, quote };
  }, [targets, selected]);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Plochy na zateplenie" className="flex flex-wrap gap-2">
        {targets.map((el) => {
          const active = selected.includes(el.id);
          return (
            <button
              key={el.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleElement(el.id)}
              className={`min-h-12 rounded-full border px-4 text-sm font-medium transition-colors ${
                active ? "border-green-700 bg-green-600 text-white" : "border-stone-300 bg-white text-stone-800"
              }`}
            >
              {el.label} · {num.format(el.netArea)} m²
            </button>
          );
        })}
      </section>

      {quote ? (
        <section aria-label="Výpočet celulózy" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <ul className="divide-y divide-stone-100 text-sm">
            {results.map((r) => (
              <li key={r.element.id} className="py-2">
                <div className="font-medium text-stone-800">{r.element.label}</div>
                <div className="text-xs text-stone-500">
                  {Math.round(r.thickness * 1000)} mm · drevo {num.format(r.woodFraction * 100)} % ·{" "}
                  {num.format(r.volumeM3)} m³ × {r.density} kg/m³ = <b className="text-stone-800">{num.format(r.kg)} kg</b>
                </div>
              </li>
            ))}
          </ul>
          <ul className="mt-2 divide-y divide-stone-100 border-t border-stone-200 text-sm">
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
          <div className="mt-3 flex items-end justify-between border-t border-stone-200 pt-3">
            <span className="text-sm text-stone-500">Fúkanie: {num.format(quote.laborHours)} h</span>
            <span className="text-2xl font-bold tabular-nums">{eur.format(quote.grossCents / 100)}</span>
          </div>
          <p className="mt-2 text-xs text-amber-700">Ceny sú zatiaľ ukážkové, bez DPH a dopravy.</p>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-stone-500">
          Ťukni na strechu, strop alebo stenu drevostavby, ktorú ideš fúkať.
        </p>
      )}
    </div>
  );
}
