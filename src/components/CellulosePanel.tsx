"use client";

import { useMemo } from "react";
import { calculateQuote } from "@/lib/calc/quote";
import { eur, num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { useHouseStore } from "@/lib/houseStore";
import { useSettingsStore } from "@/lib/settings";
import { celluloseFor, celluloseWorkItems, isCelluloseTarget } from "@/lib/trades/cellulose";
import { effectiveFuelPrice } from "@/lib/travel/fuel";
import { useFuelPrices } from "@/lib/travel/useFuelPrices";

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
      travel: {
        distanceKmOneWay: travel.distanceKmOneWay,
        trips: travel.trips,
        ratePerKm: travel.ratePerKm,
        fuel: {
          consumptionL100: travel.consumptionL100,
          pricePerL: effectiveFuelPrice(travel.fuelPriceOverride, travel.fuelType, fuelPrices),
        },
      },
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
                {vat.payer ? "Spolu s DPH" : "Spolu (neplatiteľ DPH)"} · fúkanie {num.format(quote.laborHours)} h
              </dt>
              <dd className="text-2xl font-bold tabular-nums">{eur.format(quote.grossCents / 100)}</dd>
            </div>
          </dl>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-stone-500">
          Ťukni na strechu, strop alebo stenu drevostavby, ktorú ideš fúkať.
        </p>
      )}
    </div>
  );
}
