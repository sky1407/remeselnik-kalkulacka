import type { MaterialSpec, WorkItem } from "@/lib/calc/quote";
import type { BuildingElement, ElementKind } from "@/lib/house/element";
import type { PainterSettings } from "./tradeSettings";

export interface TradeInput {
  elements: readonly BuildingElement[];
  selected: readonly string[];
}

/** Súčet čistých plôch vybraných prvkov daného typu v m². */
export function selectedArea({ elements, selected }: TradeInput, kind: ElementKind): number {
  const sum = elements.filter((e) => e.kind === kind && selected.includes(e.id)).reduce((s, e) => s + e.netArea, 0);
  return Math.round(sum * 100) / 100;
}

/** Maľba stien a stropu: farba na vrstvy, penetrácia ako samostatný materiál bez ceny práce. */
export function painterItems(input: TradeInput, s: PainterSettings): WorkItem[] {
  const walls = selectedArea(input, "wall");
  const ceiling = selectedArea(input, "ceiling");

  const paint: MaterialSpec = {
    id: "paint",
    name: `Farba ${s.paint.size} l`,
    unit: "l",
    consumptionPerM2: s.paintLPerM2,
    packageSize: s.paint.size,
    packagePrice: s.paint.price,
    waste: 0.05,
  };

  const items: WorkItem[] = [];
  if (walls > 0) {
    items.push({ label: `Maľba stien ${s.layers}×`, area: walls, layers: s.layers, material: paint, laborRatePerM2: s.laborWall, productivityM2PerHour: s.m2PerHour });
  }
  if (ceiling > 0) {
    // Strop je nad hlavou – ide pomalšie.
    items.push({ label: `Maľba stropu ${s.layers}×`, area: ceiling, layers: s.layers, material: paint, laborRatePerM2: s.laborCeiling, productivityM2PerHour: s.m2PerHour * 0.8 });
  }
  if (s.primer.enabled && walls + ceiling > 0) {
    items.push({
      label: "Penetrácia",
      area: Math.round((walls + ceiling) * 100) / 100,
      layers: 1,
      material: {
        id: "primer-paint",
        name: `Penetrácia ${s.primer.pack.size} l`,
        unit: "l",
        consumptionPerM2: s.primer.lPerM2,
        packageSize: s.primer.pack.size,
        packagePrice: s.primer.pack.price,
        waste: 0,
      },
      laborRatePerM2: 0,
      productivityM2PerHour: s.m2PerHour * 3,
    });
  }
  return items;
}

/** Maľba fasády na modeli domu: vybrané obvodové steny (vrátane štítov) bez okien a dverí. */
export function painterFacadeItems(input: TradeInput, s: PainterSettings): WorkItem[] {
  const area = selectedArea(input, "wall");
  if (area === 0) return [];
  const items: WorkItem[] = [
    {
      label: `Fasáda – maľba ${s.layers}×`,
      area,
      layers: s.layers,
      material: {
        id: "facade-paint",
        name: `Fasádna farba ${s.facade.paint.size} l`,
        unit: "l",
        consumptionPerM2: s.facade.lPerM2,
        packageSize: s.facade.paint.size,
        packagePrice: s.facade.paint.price,
        waste: 0.05,
      },
      laborRatePerM2: s.facade.labor,
      productivityM2PerHour: s.facade.m2PerHour,
    },
  ];
  if (s.primer.enabled) {
    items.push({
      label: "Fasáda – penetrácia",
      area,
      layers: 1,
      material: {
        id: "primer-facade",
        name: `Fasádna penetrácia ${s.primer.pack.size} l`,
        unit: "l",
        consumptionPerM2: s.primer.lPerM2,
        packageSize: s.primer.pack.size,
        packagePrice: s.primer.pack.price,
        waste: 0,
      },
      laborRatePerM2: 0,
      productivityM2PerHour: s.facade.m2PerHour * 3,
    });
  }
  return items;
}
