"use client";

import { useMemo } from "react";
import { netArea, rectRoomSurfaces, type Surface } from "@/lib/calc/geometry";
import { calculateQuote } from "@/lib/calc/quote";
import { ROOM_LIMITS, useCalcStore, type RoomDimensions } from "@/lib/store";
import { buildWorkItems, PAINTER } from "@/lib/trades";

const eur = new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("sk-SK", { maximumFractionDigits: 2 });

const DIMENSION_LABELS: Record<keyof RoomDimensions, string> = {
  length: "Dĺžka",
  width: "Šírka",
  height: "Výška",
};

const surfaceLabel = (s: Surface): string =>
  s.kind === "wall" ? `Stena ${"ABCD"[Number(s.id.slice(-1))]}` : s.kind === "ceiling" ? "Strop" : "Podlaha";

/** Spodný panel: rozmery, výber plôch a priebežný súčet ponuky. */
export function QuotePanel() {
  const room = useCalcStore((s) => s.room);
  const selected = useCalcStore((s) => s.selected);
  const toggleSurface = useCalcStore((s) => s.toggleSurface);
  const setDimension = useCalcStore((s) => s.setDimension);

  const surfaces = useMemo(
    () => rectRoomSurfaces(room).filter((s) => PAINTER.works[s.kind]),
    [room],
  );

  const quote = useMemo(() => {
    const items = buildWorkItems(PAINTER, room, selected);
    if (items.length === 0) return null;
    // Nastavenia regiónu, dopravy a DPH pribudnú v ďalšom kroku.
    return calculateQuote({ items, regionCoefficient: 1, vatPayer: false, vatRate: 0.23 });
  }, [room, selected]);

  return (
    <div className="flex flex-col gap-5 p-4">
      <section aria-label="Rozmery miestnosti" className="grid grid-cols-3 gap-3">
        {(Object.keys(DIMENSION_LABELS) as (keyof RoomDimensions)[]).map((key) => (
          <label key={key} className="flex flex-col gap-1 text-sm text-stone-600">
            {DIMENSION_LABELS[key]} (m)
            <input
              type="number"
              inputMode="decimal"
              step={0.05}
              min={ROOM_LIMITS[key].min}
              max={ROOM_LIMITS[key].max}
              value={room[key]}
              onChange={(e) => setDimension(key, e.target.valueAsNumber)}
              className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-lg font-semibold text-stone-900"
            />
          </label>
        ))}
      </section>

      <section aria-label="Plochy na maľovanie" className="flex flex-wrap gap-2">
        {surfaces.map((s) => {
          const active = selected.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSurface(s.id)}
              className={`min-h-12 rounded-full border px-4 text-sm font-medium transition-colors ${
                active
                  ? "border-green-700 bg-green-600 text-white"
                  : "border-stone-300 bg-white text-stone-800"
              }`}
            >
              {surfaceLabel(s)} · {num.format(netArea(s))} m²
            </button>
          );
        })}
      </section>

      {quote ? (
        <section aria-label="Cenová ponuka" className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200">
          <ul className="divide-y divide-stone-100 text-sm">
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
            <span className="text-sm text-stone-500">Odhad práce: {num.format(quote.laborHours)} h</span>
            <span className="text-2xl font-bold tabular-nums">{eur.format(quote.grossCents / 100)}</span>
          </div>
          <p className="mt-2 text-xs text-amber-700">Ceny sú zatiaľ ukážkové.</p>
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-stone-500">
          Ťukni na stenu alebo strop, ktorý ideš maľovať.
        </p>
      )}
    </div>
  );
}
