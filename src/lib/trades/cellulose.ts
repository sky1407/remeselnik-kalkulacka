import type { WorkItem } from "@/lib/calc/quote";
import type { BuildingElement } from "@/lib/house/element";
import type { CelluloseSettings } from "@/lib/settings";

export interface CelluloseResult {
  element: BuildingElement;
  thickness: number;
  /** Podiel dreva v dutine (0–1) vypočítaný zo skutočnej konštrukcie. */
  woodFraction: number;
  volumeM3: number;
  density: number;
  kg: number;
}

/** Celulóza sa fúka len do drevených konštrukcií – murovaná stena nemá dutiny. */
export const isCelluloseTarget = (el: BuildingElement): boolean => el.framing !== null && el.profile !== null;

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

/**
 * Čistý objem izolácie = plocha × hrúbka − objem dreva. Pri voľnom fúkaní na strop drevo
 * zaberá len výšku trámov, vrstva nad nimi je plná; pripočíta sa rezerva na sadanie.
 * @throws RangeError ak prvok nie je drevená konštrukcia.
 */
export function celluloseFor(el: BuildingElement, s: CelluloseSettings): CelluloseResult {
  if (!el.framing || !el.profile || el.kind === "floor") {
    throw new RangeError(`${el.label}: celulóza sa fúka len do drevenej konštrukcie`);
  }

  const loose = el.kind === "ceiling";
  const thickness = loose ? s.looseThickness : el.profile.depth;
  const woodVolume = el.netArea * el.framing.woodFraction * Math.min(thickness, el.profile.depth);
  const volume = (el.netArea * thickness - woodVolume) * (loose ? 1 + s.looseSettling : 1);
  const density = s.density[el.kind];

  return {
    element: el,
    thickness,
    woodFraction: el.framing.woodFraction,
    volumeM3: round(volume, 2),
    density,
    kg: round(volume * density, 1),
  };
}

/** Množstvo, za ktoré si remeselník účtuje prácu – každý počíta inak. */
function laborQuantity(r: CelluloseResult, unit: CelluloseSettings["laborUnit"]): number {
  switch (unit) {
    case "m3": return r.volumeM3;
    case "kg": return r.kg;
    case "m2": return r.element.netArea;
  }
}

/** Prevedie výsledky na položky ponuky; vrecia sa zrátajú zo súčtu kg všetkých plôch. */
export function celluloseWorkItems(results: readonly CelluloseResult[], s: CelluloseSettings): WorkItem[] {
  return results
    .filter((r) => r.volumeM3 > 0)
    .map((r) => ({
      label: `${r.element.label} – fúkaná celulóza ${Math.round(r.thickness * 1000)} mm (${r.volumeM3} m³)`,
      area: r.element.netArea,
      layers: 1,
      material: {
        id: "cellulose",
        name: `Celulóza, vrece ${s.bagKg} kg`,
        unit: "kg" as const,
        consumptionPerM2: r.kg / r.element.netArea,
        packageSize: s.bagKg,
        packagePrice: s.bagPrice,
        waste: 0,
      },
      laborRatePerM2: (s.laborRate * laborQuantity(r, s.laborUnit)) / r.element.netArea,
      productivityM2PerHour: (s.m3PerHour * r.element.netArea) / r.volumeM3,
    }));
}
