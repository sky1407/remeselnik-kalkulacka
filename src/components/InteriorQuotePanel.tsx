"use client";

import { useMemo } from "react";
import { calculateQuote } from "@/lib/calc/quote";
import { num } from "@/lib/format";
import type { BuildingElement } from "@/lib/house/element";
import { buildRoom, type RoomSpec } from "@/lib/interior/room";
import { selectedSurfaces, useRoomStore, type InteriorTrade } from "@/lib/interior/roomStore";
import { tileBand } from "@/lib/interior/tiler";
import { INTERIOR_TRADES, jobItems, type RoomJob } from "@/lib/interior/trades";
import { useTradeSettings } from "@/lib/interior/tradeSettings";
import { useSettingsStore } from "@/lib/settings";
import { travelForQuote } from "@/lib/travel/fuel";
import { useFuelPrices } from "@/lib/travel/useFuelPrices";
import { QuoteSummary } from "./QuoteSummary";

interface InteriorQuotePanelProps {
  room: RoomSpec;
  elements: readonly BuildingElement[];
  trade: InteriorTrade;
}

/** Výber plôch v aktívnej izbe a ponuka za všetky izby naraz. */
export function InteriorQuotePanel({ room, elements, trade }: InteriorQuotePanelProps) {
  const rooms = useRoomStore((s) => s.rooms);
  const selectedAll = useRoomStore((s) => s.selected);
  const toggleSurface = useRoomStore((s) => s.toggleSurface);
  const tradeSettings = useTradeSettings();
  const travel = useSettingsStore((s) => s.travel);
  const vat = useSettingsStore((s) => s.vat);
  const fuelPrices = useFuelPrices();
  const tradeModule = INTERIOR_TRADES[trade];

  const selected = selectedSurfaces({ selected: selectedAll }, trade, room.id);
  const targets = elements.filter((e) => tradeModule.selectableKinds.includes(e.kind));

  const quote = useMemo(() => {
    const jobs: RoomJob[] = rooms
      .map((r) => ({ room: r, selected: selectedSurfaces({ selected: selectedAll }, trade, r.id) }))
      .filter((j) => j.selected.length > 0)
      .map((j) => ({ ...j, elements: buildRoom(j.room) }));
    const items = jobItems(trade, jobs, tradeSettings);
    if (items.length === 0) return null;
    return calculateQuote({
      items,
      regionCoefficient: 1,
      travel: travelForQuote(travel, fuelPrices),
      vatPayer: vat.payer,
      vatRate: vat.rate,
    });
  }, [rooms, selectedAll, trade, tradeSettings, travel, vat, fuelPrices]);

  /** Pri obklade ukáže plochu pásu, nie celej steny. */
  const areaOf = (el: BuildingElement) =>
    trade === "tiler" && el.kind === "wall" ? tileBand(el, room.tileHeight).area : el.netArea;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Plochy" className="flex flex-wrap gap-2">
        {targets.map((el) => {
          const active = selected.includes(el.id);
          return (
            <button
              key={el.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggleSurface(trade, room.id, el.id)}
              className={`min-h-12 rounded-full border px-4 text-sm font-medium ${
                active ? "border-green-700 bg-green-600 text-white" : "border-stone-300 bg-white text-stone-800"
              }`}
            >
              {el.label} · {num.format(areaOf(el))} m²
            </button>
          );
        })}
      </section>

      {quote ? (
        <QuoteSummary quote={quote} label={tradeModule.title} hoursLabel="práca" />
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-stone-500">{tradeModule.hint}</p>
      )}
    </div>
  );
}
