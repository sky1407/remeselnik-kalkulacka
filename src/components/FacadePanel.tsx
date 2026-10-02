"use client";

import { num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { useHouseStore } from "@/lib/houseStore";
import { useTradeQuote } from "@/lib/interior/useTradeQuote";
import { QuoteSummary } from "./QuoteSummary";

export const isFacadeWall = (el: BuildingElement): boolean => el.kind === "wall";

/** Maliar v exteriéri: výber stien fasády a spoločná ponuka s izbami. */
export function FacadePanel({ elements }: { elements: readonly BuildingElement[] }) {
  const selected = useHouseStore((s) => s.selected.painter);
  const toggleElement = useHouseStore((s) => s.toggleElement);
  const quote = useTradeQuote("painter");

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Steny fasády" className="flex flex-wrap gap-2">
        {elements.filter(isFacadeWall).map((el) => {
          const active = selected.includes(el.id);
          return (
            <button
              key={el.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleElement("painter", el.id)}
              className={`min-h-12 rounded-full border px-4 text-sm font-medium ${
                active ? "border-green-700 bg-green-600 text-white" : "border-stone-300 bg-white text-stone-800"
              }`}
            >
              {el.label} · {num.format(el.netArea)} m²
            </button>
          );
        })}
      </section>
      {quote ? (
        <QuoteSummary quote={quote} label="Maľovanie – ponuka" hoursLabel="práca" />
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-stone-500">
          Ťukni na steny domu, ktoré ideš maľovať.
        </p>
      )}
      <p className="text-xs text-stone-500">Ponuka obsahuje fasádu aj izby označené v interiéri.</p>
    </div>
  );
}
