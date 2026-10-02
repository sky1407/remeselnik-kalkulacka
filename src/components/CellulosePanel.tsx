"use client";

import { useMemo } from "react";
import { calculateQuote } from "@/lib/calc/quote";
import { num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { useHouseStore } from "@/lib/houseStore";
import { useSettingsStore } from "@/lib/settings";
import { celluloseFor, celluloseWorkItems, isCelluloseTarget } from "@/lib/trades/cellulose";
import { travelForQuote } from "@/lib/travel/fuel";
import { useFuelPrices } from "@/lib/travel/useFuelPrices";
import { QuoteSummary } from "./QuoteSummary";

/** Výber plôch na zateplenie a priebežný výpočet celulózy s cenovou ponukou. */
export function CellulosePanel({ elements }: { elements: readonly BuildingElement[] }) {
  const selected = useHouseStore((s) => s.selected);
  const toggleElement = useHouseStore((s) => s.toggleElement);
  const cellulose = useSettingsStore((s) => s.cellulose);
  const travel = useSettingsStore((s) => s.travel);
  const vat = useSettingsStore((s) => s.vat);
  const fuelPrices = useFuelPrices();

  const targets = useMemo(() => elements.filter(isCelluloseTarget), [elements]);

  const { results, quote } = useMemo(() => {
    const results = targets.filter((el) => selected.includes(el.id)).map((el) => celluloseFor(el, cellulose));
    const items = celluloseWorkItems(results, cellulose);
    if (items.length === 0) return { results, quote: null };
    const quote = calculateQuote({
      items,
      // Regionálny koeficient príde s dátami ŠÚ SR – cenu práce si zatiaľ zadáva remeselník sám.
      regionCoefficient: 1,
      travel: travelForQuote(travel, fuelPrices),
      vatPayer: vat.payer,
      vatRate: vat.rate,
    });
    return { results, quote };
  }, [targets, selected, cellulose, travel, vat, fuelPrices]);

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
        <QuoteSummary
          quote={quote}
          label="Výpočet celulózy"
          hoursLabel="fúkanie"
          details={
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
          }
        />
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-stone-500">
          Ťukni na strechu, strop alebo stenu drevostavby, ktorú ideš fúkať.
        </p>
      )}
    </div>
  );
}
