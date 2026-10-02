import { makeElement, type BuildingElement, type Frame3D } from "./element";
import type { Polygon } from "./geometry2d";
import type { HouseParams } from "./house";

export type WallIndex = 0 | 1 | 2 | 3;

/**
 * Modul strechy – určuje tvar štítových stien a generuje strešné plochy.
 * Nový typ strechy (valbová, pultová…) = nový modul v `ROOFS`, zvyšok aplikácie sa nemení.
 */
export interface RoofModule {
  label: string;
  /** Rozsah sklonu v stupňoch; `null` = sklon sa nenastavuje. */
  pitch: { min: number; max: number; default: number } | null;
  /** Obrys steny v lokálnych súradniciach (u pozdĺž steny, v hore); `null` = stena neexistuje. */
  wallOutline(index: WallIndex, p: HouseParams): Polygon | null;
  /** Výšky vodorovných prahov v stenách drevostavby. */
  wallPlateLevels(p: HouseParams): number[];
  elements(p: HouseParams): BuildingElement[];
}

const rect = (w: number, h: number): Polygon => [[0, 0], [w, 0], [w, h], [0, h]];
const wallLength = (i: WallIndex, p: HouseParams) => (i % 2 === 0 ? p.length : p.width);
const deg = (d: number) => (d * Math.PI) / 180;

function pitchOf(roofModule: RoofModule, p: HouseParams): number {
  const range = roofModule.pitch;
  if (!range) return 0;
  return deg(Math.min(range.max, Math.max(range.min, p.roof.pitchDeg)));
}

/** Dve strešné roviny od odkvapu vo výške `eaveY` po hrebeň. Krokvy idú po spáde (os v). */
function pitchedPlanes(p: HouseParams, pitch: number, eaveY: number): BuildingElement[] {
  const { length: l, width: w, roof } = p;
  const s = Math.sin(pitch);
  const c = Math.cos(pitch);
  const slope = w / 2 / c;
  const o = roof.overhang;
  const cover = { outline: [[-o, -o / c], [l + o, -o / c], [l + o, slope], [-o, slope]] as Polygon, offset: 0.02 };

  const planes: { id: string; label: string; frame: Frame3D }[] = [
    {
      id: "roof-front",
      label: "Strecha – predná rovina",
      frame: { origin: [-l / 2, eaveY, w / 2], u: [1, 0, 0], v: [0, s, -c] },
    },
    {
      id: "roof-back",
      label: "Strecha – zadná rovina",
      frame: { origin: [l / 2, eaveY, -w / 2], u: [-1, 0, 0], v: [0, s, c] },
    },
  ];

  return planes.map((pl) =>
    makeElement({ ...pl, kind: "roof", outline: rect(l, slope), profile: p.rafter, cover }),
  );
}

const gable: RoofModule = {
  label: "Sedlová",
  pitch: { min: 15, max: 55, default: 35 },
  wallOutline(i, p) {
    const len = wallLength(i, p);
    if (i % 2 === 0) return rect(len, p.wallHeight);
    const ridge = p.wallHeight + (p.width / 2) * Math.tan(pitchOf(gable, p));
    return [[0, 0], [len, 0], [len, p.wallHeight], [len / 2, ridge], [0, p.wallHeight]];
  },
  wallPlateLevels: (p) => [0, p.wallHeight],
  elements(p) {
    const ceiling = makeElement({
      id: "ceiling",
      kind: "ceiling",
      label: "Strop pod podkrovím",
      // n = −y: podhľad je dole v miestnosti, trámy a fúkaná izolácia idú hore do podkrovia.
      frame: { origin: [-p.length / 2, p.wallHeight, -p.width / 2], u: [1, 0, 0], v: [0, 0, 1] },
      outline: rect(p.length, p.width),
      profile: p.rafter,
    });
    return [...pitchedPlanes(p, pitchOf(gable, p), p.wallHeight), ceiling];
  },
};

const aframe: RoofModule = {
  label: "Áčková",
  pitch: { min: 50, max: 70, default: 60 },
  wallOutline(i, p) {
    if (i % 2 === 0) return null;
    const ridge = (p.width / 2) * Math.tan(pitchOf(aframe, p));
    return [[0, 0], [p.width, 0], [p.width / 2, ridge]];
  },
  wallPlateLevels: () => [0],
  elements: (p) => pitchedPlanes(p, pitchOf(aframe, p), 0),
};

const flat: RoofModule = {
  label: "Rovná",
  pitch: null,
  wallOutline: (i, p) => rect(wallLength(i, p), p.wallHeight),
  wallPlateLevels: (p) => [0, p.wallHeight],
  elements(p) {
    const o = p.roof.overhang;
    return [
      makeElement({
        id: "flat-roof",
        kind: "flat-roof",
        label: "Plochá strecha",
        frame: { origin: [-p.length / 2, p.wallHeight, -p.width / 2], u: [1, 0, 0], v: [0, 0, 1] },
        outline: rect(p.length, p.width),
        profile: p.rafter,
        // Krytina leží nad stropnicami, teda na opačnej strane ako podhľad.
        cover: {
          outline: [[-o, -o], [p.length + o, -o], [p.length + o, p.width + o], [-o, p.width + o]],
          offset: -(p.rafter.depth + 0.09),
        },
      }),
    ];
  },
};

export const ROOFS = { flat, gable, aframe } as const satisfies Record<string, RoofModule>;
export type RoofType = keyof typeof ROOFS;
export const ROOF_TYPES = Object.keys(ROOFS) as [RoofType, ...RoofType[]];

/** Výška hrebeňa nad terénom – na nastavenie kamery. */
export function ridgeHeight(p: HouseParams): number {
  const roofModule = ROOFS[p.roof.type];
  const pitch = pitchOf(roofModule, p);
  const eave = p.roof.type === "aframe" ? 0 : p.wallHeight;
  return eave + (p.width / 2) * Math.tan(pitch);
}
