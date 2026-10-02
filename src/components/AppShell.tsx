"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppStore, type Trade } from "@/lib/appStore";
import { buildHouse } from "@/lib/house/house";
import { useHouseStore, type ViewLayer } from "@/lib/houseStore";
import { buildRoom } from "@/lib/interior/room";
import { useRoomStore, type InteriorTrade, type InteriorView } from "@/lib/interior/roomStore";
import { INTERIOR_TRADES } from "@/lib/interior/trades";
import { useTradeSettings } from "@/lib/interior/tradeSettings";
import { useSettingsStore } from "@/lib/settings";
import { isCelluloseTarget } from "@/lib/trades/cellulose";
import { CellulosePanel } from "./CellulosePanel";
import { HouseControls } from "./HouseControls";
import { HouseScene } from "./HouseScene";
import { InteriorQuotePanel } from "./InteriorQuotePanel";
import { PanelSheet } from "./PanelSheet";
import { RoomPanel } from "./RoomPanel";
import { RoomScene } from "./RoomScene";
import { SettingsPanel, VatPanel } from "./SettingsPanel";
import { TradeSettingsPanel } from "./TradeSettingsPanel";
import { TravelPanel } from "./TravelPanel";

const TRADES: { value: Trade; label: string; icon: string }[] = [
  { value: "cellulose", label: "Celulóza", icon: "🏠" },
  { value: "painter", label: "Maliar", icon: "🖌️" },
  { value: "tiler", label: "Obkladač", icon: "🧱" },
  { value: "drywall", label: "Sadrokartón", icon: "▦" },
];

const overlayButton = "min-h-10 rounded-full bg-white/90 px-4 text-sm font-semibold text-stone-800 shadow-md";

function TradePicker() {
  const trade = useAppStore((s) => s.trade);
  const setTrade = useAppStore((s) => s.setTrade);
  return (
    <div role="group" aria-label="Remeslo" className="grid grid-cols-4 gap-1.5">
      {TRADES.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-pressed={trade === t.value}
          onClick={() => setTrade(t.value)}
          className={`flex min-h-12 flex-col items-center justify-center rounded-xl border-2 px-1 text-xs font-semibold ${
            trade === t.value ? "border-green-600 bg-green-50 text-green-800" : "border-stone-200 bg-white text-stone-700"
          }`}
        >
          <span aria-hidden className="text-base leading-none">
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface ToggleOption<T extends string> {
  value: T;
  label: string;
}

function ViewToggle<T extends string>({ value, options, onChange }: { value: T; options: ToggleOption<T>[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label="Pohľad" className="absolute left-3 top-3 flex rounded-full bg-white/90 p-1 shadow-md">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-full px-4 text-sm font-semibold ${value === o.value ? "bg-stone-900 text-white" : "text-stone-700"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface WorkspaceProps {
  sceneLabel: string;
  scene: ReactNode;
  toolbar: ReactNode;
  onFit: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Rozloženie pevne na výšku obrazovky: 3D má vlastnú plochu a panel (mobil: spodná lišta,
 * PC: bočný panel) sa posúva samostatne, takže model nikdy neodíde z obrazovky.
 */
function Workspace({ sceneLabel, scene, toolbar, onFit, title, children }: WorkspaceProps) {
  const [panelHidden, setPanelHidden] = useState(false);
  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden md:flex-row">
      <section aria-label={sceneLabel} className="relative min-h-0 flex-1 touch-none bg-gradient-to-b from-sky-100 to-sky-50">
        {scene}
        {toolbar}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
          <button type="button" onClick={onFit} className={overlayButton}>
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
        title={
          <div className="flex flex-col gap-2">
            <TradePicker />
            <h1 className="text-lg font-bold">{title}</h1>
          </div>
        }
      >
        <div className="flex flex-col gap-6">
          {children}
          <TravelPanel />
          <VatPanel />
        </div>
      </PanelSheet>
    </main>
  );
}

const HOUSE_LAYERS: ToggleOption<ViewLayer>[] = [
  { value: "exterior", label: "Exteriér" },
  { value: "structure", label: "Konštrukcia" },
];

function CelluloseWorkspace() {
  const params = useHouseStore((s) => s.params);
  const layer = useHouseStore((s) => s.layer);
  const setLayer = useHouseStore((s) => s.setLayer);
  const requestFit = useHouseStore((s) => s.requestFit);
  // Dom sa skladá raz a zdieľa ho 3D scéna aj výpočet.
  const elements = useMemo(() => buildHouse(params), [params]);

  return (
    <Workspace
      sceneLabel="3D model domu"
      scene={<HouseScene elements={elements} isSelectable={isCelluloseTarget} />}
      toolbar={<ViewToggle value={layer} options={HOUSE_LAYERS} onChange={setLayer} />}
      onFit={requestFit}
      title="Fúkaná celulóza – nová ponuka"
    >
      <HouseControls />
      <CellulosePanel elements={elements} />
      <SettingsPanel />
    </Workspace>
  );
}

const ROOM_VIEWS: ToggleOption<InteriorView>[] = [
  { value: "dollhouse", label: "Domček" },
  { value: "inside", label: "Zvnútra" },
];

function InteriorWorkspace({ trade }: { trade: InteriorTrade }) {
  const rooms = useRoomStore((s) => s.rooms);
  const activeId = useRoomStore((s) => s.activeId);
  const view = useRoomStore((s) => s.view);
  const setView = useRoomStore((s) => s.setView);
  const requestFit = useRoomStore((s) => s.requestFit);
  const room = rooms.find((r) => r.id === activeId) ?? rooms[0];
  const elements = useMemo(() => buildRoom(room), [room]);

  return (
    <Workspace
      sceneLabel={`3D interiér – ${room.name}`}
      scene={<RoomScene room={room} elements={elements} trade={trade} />}
      toolbar={<ViewToggle value={view} options={ROOM_VIEWS} onChange={setView} />}
      onFit={requestFit}
      title={INTERIOR_TRADES[trade].title}
    >
      <RoomPanel room={room} elements={elements} trade={trade} />
      <InteriorQuotePanel room={room} elements={elements} trade={trade} />
      <TradeSettingsPanel trade={trade} />
    </Workspace>
  );
}

/** Koreň aplikácie: podľa remesla ukáže dom (celulóza) alebo interiér izieb. */
export function AppShell() {
  const trade = useAppStore((s) => s.trade);

  // Uložené ceny a izby sa načítajú až v prehliadači, aby sa nelíšil serverový a klientsky HTML.
  useEffect(() => {
    void useSettingsStore.persist.rehydrate();
    void useTradeSettings.persist.rehydrate();
    void useRoomStore.persist.rehydrate();
  }, []);

  return trade === "cellulose" ? <CelluloseWorkspace /> : <InteriorWorkspace trade={trade} />;
}
