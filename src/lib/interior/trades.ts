import type { WorkItem } from "@/lib/calc/quote";
import type { BuildingElement, ElementKind } from "@/lib/house/element";
import { drywallItems } from "./drywall";
import { painterItems } from "./painter";
import type { RoomSpec } from "./room";
import type { InteriorTrade } from "./roomStore";
import { tilerItems } from "./tiler";
import type { TradeSettings } from "./tradeSettings";

export interface RoomJob {
  room: RoomSpec;
  elements: readonly BuildingElement[];
  selected: readonly string[];
}

/** Modul remesla v interiéri – nové remeslo = nový záznam v `INTERIOR_TRADES`. */
export interface InteriorTradeModule {
  label: string;
  title: string;
  /** Plochy, na ktoré sa v 3D dá ťuknúť. */
  selectableKinds: readonly ElementKind[];
  hint: string;
  items: (job: RoomJob, s: TradeSettings) => WorkItem[];
}

export const INTERIOR_TRADES: Record<InteriorTrade, InteriorTradeModule> = {
  painter: {
    label: "Maliar",
    title: "Maľovanie – nová ponuka",
    selectableKinds: ["wall", "ceiling"],
    hint: "Ťukni na steny a strop, ktoré ideš maľovať.",
    items: (job, s) => painterItems(job, s.painter),
  },
  tiler: {
    label: "Obkladač",
    title: "Obklad a dlažba – nová ponuka",
    selectableKinds: ["wall", "floor"],
    hint: "Ťukni na steny na obklad a na podlahu na dlažbu.",
    items: (job, s) => tilerItems(job, s.tiler),
  },
  drywall: {
    label: "Sadrokartón",
    title: "Sadrokartón – nová ponuka",
    selectableKinds: ["wall", "ceiling"],
    hint: "Ťukni na strop (podhľad) alebo steny (predsadená stena).",
    items: (job, s) => drywallItems(job, s.drywall),
  },
};

/** Položky za všetky izby; názov izby sa pridá pred položku, materiál sa sčíta naprieč izbami. */
export function jobItems(trade: InteriorTrade, jobs: readonly RoomJob[], s: TradeSettings): WorkItem[] {
  return jobs.flatMap((job) =>
    INTERIOR_TRADES[trade].items(job, s).map((item) => ({ ...item, label: `${job.room.name} – ${item.label}` })),
  );
}
