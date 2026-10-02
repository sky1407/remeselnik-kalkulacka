"use client";

import { useEffect, useMemo } from "react";
import { buildHouse } from "@/lib/house/house";
import { useHouseStore, type ViewLayer } from "@/lib/houseStore";
import { useSettingsStore } from "@/lib/settings";
import { isCelluloseTarget } from "@/lib/trades/cellulose";
import { CellulosePanel } from "./CellulosePanel";
import { HouseControls } from "./HouseControls";
import { HouseScene } from "./HouseScene";
import { SettingsPanel } from "./SettingsPanel";
import { TravelPanel } from "./TravelPanel";

const LAYERS: { value: ViewLayer; label: string }[] = [
  { value: "exterior", label: "Exteriér" },
  { value: "structure", label: "Konštrukcia" },
];

/** Kalkulačka fúkanej celulózy: 3D dom hore, ovládanie a výpočet pod ním (na PC vedľa). */
export function HouseApp() {
  const params = useHouseStore((s) => s.params);
  const layer = useHouseStore((s) => s.layer);
  const setLayer = useHouseStore((s) => s.setLayer);

  // Uložené ceny remeselníka sa načítajú až v prehliadači, aby sa nelíšil serverový a klientsky HTML.
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);

  // Dom sa skladá raz a zdieľa ho 3D scéna aj výpočet.
  const elements = useMemo(() => buildHouse(params), [params]);

  return (
    <main className="flex flex-1 flex-col lg:h-svh lg:flex-row">
      <div className="relative h-[50svh] touch-none bg-gradient-to-b from-sky-100 to-sky-50 lg:h-auto lg:flex-1">
        <HouseScene elements={elements} isSelectable={isCelluloseTarget} />
        <div role="group" aria-label="Pohľad" className="absolute left-3 top-3 flex rounded-full bg-white/90 p-1 shadow-md">
          {LAYERS.map((l) => (
            <button
              key={l.value}
              type="button"
              aria-pressed={layer === l.value}
              onClick={() => setLayer(l.value)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                layer === l.value ? "bg-stone-900 text-white" : "text-stone-700"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-6 p-4 lg:w-[440px] lg:overflow-y-auto lg:border-l lg:border-stone-200">
        <h1 className="text-xl font-bold">Fúkaná celulóza – nová ponuka</h1>
        <HouseControls />
        <CellulosePanel elements={elements} />
        <TravelPanel />
        <SettingsPanel />
      </div>
    </main>
  );
}
