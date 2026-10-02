import type { WorkItem } from "@/lib/calc/quote";
import type { BuildingElement, ElementKind } from "@/lib/house/element";

/**
 * Objemová hmotnosť podľa typu konštrukcie (kg/m³) – stred rozsahov z technických listov ISOCELL:
 * voľné fúkanie 28–40, tlakové fúkanie do uzavretých dutín 38–65.
 */
export const DENSITY: Record<ElementKind, number> = {
  ceiling: 32,
  roof: 45,
  "flat-roof": 45,
  wall: 55,
};

export interface CelluloseSettings {
  /** Hmotnosť vreca v kg (ISOCELL: 15 kg). */
  bagKg: number;
  /** Cena vreca v € bez DPH. */
  bagPrice: number;
  /** Cena práce za m³ nafúkaného objemu v € bez DPH. */
  laborPerM3: number;
  /** Výkon fúkania v m³/h. */
  m3PerHour: number;
  /** Hrúbka voľne fúkanej vrstvy na strop v m (môže byť vyššia ako stropné trámy). */
  looseThickness: number;
  /** Rezerva na sadanie pri voľnom fúkaní (0.15 = 15 %). */
  looseSettling: number;
}

/** UKÁŽKOVÉ ceny – nahradí ich cenník remeselníka. */
export const DEFAULT_CELLULOSE: CelluloseSettings = {
  bagKg: 15,
  bagPrice: 14,
  laborPerM3: 25,
  m3PerHour: 4,
  looseThickness: 0.3,
  looseSettling: 0.15,
};

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
  if (!el.framing || !el.profile) throw new RangeError(`${el.label}: celulóza sa fúka len do drevenej konštrukcie`);

  const loose = el.kind === "ceiling";
  const thickness = loose ? s.looseThickness : el.profile.depth;
  const woodVolume = el.netArea * el.framing.woodFraction * Math.min(thickness, el.profile.depth);
  const volume = (el.netArea * thickness - woodVolume) * (loose ? 1 + s.looseSettling : 1);
  const density = DENSITY[el.kind];

  return {
    element: el,
    thickness,
    woodFraction: el.framing.woodFraction,
    volumeM3: round(volume, 2),
    density,
    kg: round(volume * density, 1),
  };
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
      laborRatePerM2: (s.laborPerM3 * r.volumeM3) / r.element.netArea,
      productivityM2PerHour: (s.m3PerHour * r.element.netArea) / r.volumeM3,
    }));
}
