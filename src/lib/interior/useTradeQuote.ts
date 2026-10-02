"use client";

import { useMemo } from "react";
import { calculateQuote, type Quote } from "@/lib/calc/quote";
import { buildHouse } from "@/lib/house/house";
import { useHouseStore } from "@/lib/houseStore";
import { useSettingsStore } from "@/lib/settings";
import { travelForQuote } from "@/lib/travel/fuel";
import { useFuelPrices } from "@/lib/travel/useFuelPrices";
import { painterFacadeItems } from "./painter";
import { buildRoom } from "./room";
import { selectedSurfaces, useRoomStore, type InteriorTrade } from "./roomStore";
import { jobItems, type RoomJob } from "./trades";
import { useTradeSettings } from "./tradeSettings";

/**
 * Jedna ponuka za celé remeslo: všetky izby, pri maliarovi aj fasáda domu.
 * Materiál sa zlúči (napr. penetrácia z viacerých izieb do spoločných balení).
 */
export function useTradeQuote(trade: InteriorTrade): Quote | null {
  const rooms = useRoomStore((s) => s.rooms);
  const selectedAll = useRoomStore((s) => s.selected);
  const houseParams = useHouseStore((s) => s.params);
  const facadeSelected = useHouseStore((s) => s.selected.painter);
  const tradeSettings = useTradeSettings();
  const travel = useSettingsStore((s) => s.travel);
  const vat = useSettingsStore((s) => s.vat);
  const fuelPrices = useFuelPrices();

  return useMemo(() => {
    const jobs: RoomJob[] = rooms
      .map((room) => ({ room, selected: selectedSurfaces({ selected: selectedAll }, trade, room.id) }))
      .filter((j) => j.selected.length > 0)
      .map((j) => ({ ...j, elements: buildRoom(j.room) }));
    const items = jobItems(trade, jobs, tradeSettings);
    if (trade === "painter" && facadeSelected.length > 0) {
      items.push(...painterFacadeItems({ elements: buildHouse(houseParams), selected: facadeSelected }, tradeSettings.painter));
    }
    if (items.length === 0) return null;
    return calculateQuote({
      items,
      regionCoefficient: 1,
      travel: travelForQuote(travel, fuelPrices),
      vatPayer: vat.payer,
      vatRate: vat.rate,
    });
  }, [rooms, selectedAll, trade, tradeSettings, houseParams, facadeSelected, travel, vat, fuelPrices]);
}
