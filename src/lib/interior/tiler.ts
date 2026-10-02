import type { MaterialSpec, WorkItem } from "@/lib/calc/quote";
import type { BuildingElement, Opening } from "@/lib/house/element";
import type { Polygon } from "@/lib/house/geometry2d";
import { selectedArea, type TradeInput } from "./painter";
import { roomPerimeter, type RoomSpec } from "./room";
import { PATTERN_WASTE, type TilerSettings } from "./tradeSettings";

/** Pás obkladu na stene od podlahy po výšku `height`, s otvormi orezanými na pás – pre výpočet aj 3D. */
export function tileBand(wall: BuildingElement, height: number): { outline: Polygon; holes: Opening[]; area: number } {
  const len = Math.max(...wall.outline.map((p) => p[0]));
  const top = Math.min(height, Math.max(...wall.outline.map((p) => p[1])));
  const holes = wall.openings
    .filter((o) => o.v0 < top)
    .map((o) => ({ ...o, v0: Math.max(o.v0, 0), v1: Math.min(o.v1, top) }));
  const holeArea = holes.reduce((s, o) => s + (o.u1 - o.u0) * (o.v1 - o.v0), 0);
  return {
    outline: [[0, 0], [len, 0], [len, top], [0, top]],
    holes,
    area: Math.max(0, Math.round((len * top - holeArea) * 100) / 100),
  };
}

/**
 * Spotreba škárovačky v kg/m² podľa bežného vzorca výrobcov:
 * (A + B) / (A × B) × hrúbka × šírka škáry × 1,6 – všetko v mm.
 */
export function groutKgPerM2(aMm: number, bMm: number, thicknessMm: number, jointMm: number): number {
  return ((aMm + bMm) / (aMm * bMm)) * thicknessMm * jointMm * 1.6;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Obklad stien do výšky izby, dlažba, lepidlo, škárovačka, penetrácia a v kúpeľni hydroizolácia. */
export function tilerItems(input: TradeInput & { room: RoomSpec }, s: TilerSettings): WorkItem[] {
  const height = Math.min(input.room.tileHeight, input.room.height);
  const wallArea = r2(
    height > 0
      ? input.elements
          .filter((e) => e.kind === "wall" && input.selected.includes(e.id))
          .reduce((sum, w) => sum + tileBand(w, height).area, 0)
      : 0,
  );
  const floorArea = selectedArea(input, "floor");
  const waste = PATTERN_WASTE[s.pattern];

  const tileMaterial = (kind: "wall" | "floor"): MaterialSpec => {
    const t = kind === "wall" ? s.wallTile : s.floorTile;
    return {
      id: `tile-${kind}-${t.a}x${t.b}`,
      name: `${kind === "wall" ? "Obklad" : "Dlažba"} ${t.a}×${t.b} mm (bal. ${t.boxM2} m²)`,
      unit: "m2",
      consumptionPerM2: 1,
      packageSize: t.boxM2,
      packagePrice: r2(t.pricePerM2 * t.boxM2),
      waste,
    };
  };
  const pack = (id: string, name: string, unit: MaterialSpec["unit"], perM2: number, p: { size: number; price: number }): MaterialSpec => ({
    id, name: `${name} ${p.size} ${unit}`, unit, consumptionPerM2: perM2, packageSize: p.size, packagePrice: p.price, waste: 0,
  });
  const materialOnly = (label: string, area: number, material: MaterialSpec): WorkItem => ({
    label, area, layers: 1, material, laborRatePerM2: 0, productivityM2PerHour: 1000,
  });

  const items: WorkItem[] = [];
  const surfaces = [
    { kind: "wall" as const, area: wallArea, tile: s.wallTile, labor: s.laborWall, label: `Obklad stien do ${height} m` },
    { kind: "floor" as const, area: floorArea, tile: s.floorTile, labor: s.laborFloor, label: "Dlažba" },
  ].filter((x) => x.area > 0);

  for (const x of surfaces) {
    items.push({ label: x.label, area: x.area, layers: 1, material: tileMaterial(x.kind), laborRatePerM2: x.labor, productivityM2PerHour: s.m2PerHour });
    const grout = groutKgPerM2(x.tile.a, x.tile.b, s.tileThicknessMm, s.jointMm);
    items.push(materialOnly("Škárovačka", x.area, pack("grout", "Škárovačka", "kg", grout, s.grout)));
  }

  const total = r2(wallArea + floorArea);
  if (total > 0) {
    items.push(materialOnly("Lepidlo", total, pack("adhesive", "Lepidlo", "kg", s.adhesiveKgPerM2, s.adhesive)));
    items.push(materialOnly("Penetrácia", total, pack("primer-tile", "Penetrácia", "l", s.primer.lPerM2, s.primer.pack)));
  }

  if (input.room.wetZone && floorArea > 0) {
    // Podlaha + vytiahnutie na steny po obvode (sokel); sprchový kút zatiaľ zadá remeselník cez výšku obkladu.
    const area = r2(floorArea + roomPerimeter(input.room) * s.waterproofing.upstandM);
    items.push(materialOnly("Hydroizolácia", area, pack("waterproofing", "Hydroizolácia", "kg", s.waterproofing.kgPerM2, s.waterproofing.pack)));
  }
  return items;
}
