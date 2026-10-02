"use client";

import { useEffect, useMemo, useState } from "react";
import { buildHouse } from "@/lib/house/house";
import { useHouseStore, type ViewLayer } from "@/lib/houseStore";
import { useSettingsStore } from "@/lib/settings";
import { isCelluloseTarget } from "@/lib/trades/cellulose";
import { CellulosePanel } from "./CellulosePanel";
import { HouseControls } from "./HouseControls";
import { HouseScene } from "./HouseScene";
import { PanelSheet } from "./PanelSheet";
import { SettingsPanel } from "./SettingsPanel";
import { TravelPanel } from "./TravelPanel";

const LAYERS: { value: ViewLayer; label: string }[] = [
  { value: "exterior", label: "Exteriér" },
  { value: "structure", label: "Konštrukcia" },
];

const overlayButton = "min-h-10 rounded-full bg-white/90 px-4 text-sm font-semibold text-stone-800 shadow-md";

/**
 * Kalkulačka fúkanej celulózy. Rozloženie je pevne na výšku obrazovky: 3D model má vlastnú plochu
 * a panel (mobil: spodná lišta, PC: bočný panel) sa posúva samostatne, takže model nikdy neodíde.
 */
export function HouseApp() {
  const params = useHouseStore((s) => s.params);
  const layer = useHouseStore((s) => s.layer);
  const setLayer = useHouseStore((s) => s.setLayer);
  const requestFit = useHouseStore((s) => s.requestFit);
  const [panelHidden, setPanelHidden] = useState(false);

  // Uložené ceny remeselníka sa načítajú až v prehliadači, aby sa nelíšil serverový a klientsky HTML.
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
  }, []);

  // Dom sa skladá raz a zdieľa ho 3D scéna aj výpočet.
  const elements = useMemo(() => buildHouse(params), [params]);

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden md:flex-row">
      <section
        aria-label="3D model domu"
        className="relative min-h-0 flex-1 touch-none bg-gradient-to-b from-sky-100 to-sky-50"
      >
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

        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          <button type="button" onClick={requestFit} className={overlayButton}>
            ⌖ Vycentrovať
          </button>
          <button
            type="button"
            onClick={() => setPanelHidden((h) => !h)}
            aria-pressed={!panelHidden}
            className={`${overlayButton} hidden md:block`}
          >
            {panelHidden ? "◂ Zobraziť panel" : "Skryť panel ▸"}
          </button>
        </div>

        <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-stone-500">
          <span className="md:hidden">1 prst otáča · 2 prsty posúvajú a približujú</span>
          <span className="hidden md:inline">ľavé tlačidlo otáča · pravé posúva · koliesko približuje</span>
        </p>
      </section>

      <PanelSheet
        hiddenOnDesktop={panelHidden}
        title={<h1 className="text-lg font-bold">Fúkaná celulóza – nová ponuka</h1>}
      >
        <div className="flex flex-col gap-6">
          <HouseControls />
          <CellulosePanel elements={elements} />
          <TravelPanel />
          <SettingsPanel />
        </div>
      </PanelSheet>
    </main>
  );
}
