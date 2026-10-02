import { netArea, rectRoomSurfaces, type SurfaceKind } from "@/lib/calc/geometry";
import type { MaterialSpec, WorkItem } from "@/lib/calc/quote";
import type { RoomDimensions } from "@/lib/store";

/** Druh práce, ktorý remeslo vykoná na určitom type plochy. */
export interface TradeWork {
  label: string;
  layers: number;
  material: MaterialSpec;
  laborRatePerM2: number;
  productivityM2PerHour: number;
}

export interface Trade {
  id: string;
  name: string;
  works: Partial<Record<SurfaceKind, TradeWork>>;
}

/**
 * UKÁŽKOVÉ ceny – nahradia ich ceny z e-shopov a vlastný cenník remeselníka.
 * Spotreba 0,2 kg/m² na vrstvu zodpovedá bežnej interiérovej disperznej farbe.
 */
const interiorPaint: MaterialSpec = {
  id: "paint-interior-15kg",
  name: "Interiérová farba biela 15 kg",
  unit: "kg",
  consumptionPerM2: 0.2,
  packageSize: 15,
  packagePrice: 25,
  waste: 0.1,
};

export const PAINTER: Trade = {
  id: "painter",
  name: "Maliar",
  works: {
    wall: { label: "Maľba stien 2×", layers: 2, material: interiorPaint, laborRatePerM2: 3.5, productivityM2PerHour: 12 },
    ceiling: { label: "Maľba stropu 2×", layers: 2, material: interiorPaint, laborRatePerM2: 4, productivityM2PerHour: 8 },
  },
};

export const selectableKinds = (trade: Trade): SurfaceKind[] =>
  Object.keys(trade.works) as SurfaceKind[];

/** Z vybraných plôch poskladá položky ponuky – jedna položka na typ plochy so súčtom m². */
export function buildWorkItems(trade: Trade, room: RoomDimensions, selected: readonly string[]): WorkItem[] {
  const areaByKind = new Map<SurfaceKind, number>();
  for (const surface of rectRoomSurfaces(room)) {
    if (!selected.includes(surface.id) || !trade.works[surface.kind]) continue;
    areaByKind.set(surface.kind, (areaByKind.get(surface.kind) ?? 0) + netArea(surface));
  }

  return [...areaByKind].map(([kind, area]) => {
    const work = trade.works[kind]!;
    return { ...work, area: Math.round(area * 100) / 100 };
  });
}
