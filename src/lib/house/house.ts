import { z } from "zod";
import { makeElement, type BuildingElement, type Frame3D, type Opening } from "./element";
import { ROOF_TYPES, ROOFS, type WallIndex } from "./roofs";

const range = (min: number, max: number) => z.number().finite().min(min).max(max);

const ProfileSchema = z
  .object({ width: range(0.03, 0.3), depth: range(0.05, 0.5), spacing: range(0.3, 1.5) })
  .refine((p) => p.spacing > p.width * 2, "Rozostup musí byť aspoň dvojnásobok šírky prvku");

export const OpeningSpecSchema = z.object({
  wall: z.number().int().min(0).max(3),
  kind: z.enum(["window", "door"]),
  /** Poloha stredu otvoru pozdĺž steny ako podiel 0–1. */
  position: range(0, 1),
  width: range(0.4, 3),
  height: range(0.4, 2.5),
  /** Výška parapetu nad podlahou (0 pri dverách). */
  sill: range(0, 2),
});

export const HouseParamsSchema = z.object({
  length: range(4, 20),
  width: range(4, 14),
  wallHeight: range(2.2, 4),
  construction: z.enum(["timber", "masonry"]),
  roof: z.object({ type: z.enum(ROOF_TYPES), pitchDeg: range(0, 75), overhang: range(0, 1.2) }),
  stud: ProfileSchema,
  rafter: ProfileSchema,
  openings: z.array(OpeningSpecSchema).max(40),
});

export type HouseParams = z.infer<typeof HouseParamsSchema>;
export type OpeningSpec = z.infer<typeof OpeningSpecSchema>;

const windowAt = (wall: number, position: number): OpeningSpec => ({
  wall, kind: "window", position, width: 1.2, height: 1.4, sill: 0.9,
});

/** Typický bungalov: drevostavba 10 × 8 m, sedlová strecha 35°. */
export const DEFAULT_HOUSE: HouseParams = {
  length: 10,
  width: 8,
  wallHeight: 2.8,
  construction: "timber",
  roof: { type: "gable", pitchDeg: 35, overhang: 0.5 },
  stud: { width: 0.06, depth: 0.16, spacing: 0.625 },
  rafter: { width: 0.08, depth: 0.2, spacing: 0.9 },
  openings: [
    { wall: 0, kind: "door", position: 0.5, width: 1, height: 2.1, sill: 0 },
    windowAt(0, 0.2),
    windowAt(0, 0.8),
    windowAt(2, 0.3),
    windowAt(2, 0.7),
    { ...windowAt(1, 0.5), width: 1 },
    { ...windowAt(3, 0.5), width: 1 },
  ],
};

/** Murovaná stena – len na vykreslenie, objem dutín je nulový. */
const MASONRY_THICKNESS = 0.3;

const WALL_LABELS = ["Stena A – predná", "Stena B – pravá", "Stena C – zadná", "Stena D – ľavá"] as const;

/** Exteriérová rovina steny; n = u × v smeruje von z domu. */
function wallFrame(i: WallIndex, l: number, w: number): Frame3D {
  switch (i) {
    case 0: return { origin: [-l / 2, 0, w / 2], u: [1, 0, 0], v: [0, 1, 0] };
    case 1: return { origin: [l / 2, 0, w / 2], u: [0, 0, -1], v: [0, 1, 0] };
    case 2: return { origin: [l / 2, 0, -w / 2], u: [-1, 0, 0], v: [0, 1, 0] };
    case 3: return { origin: [-l / 2, 0, -w / 2], u: [0, 0, 1], v: [0, 1, 0] };
  }
}

/** Umiestni otvor na stenu; poloha sa obmedzí tak, aby otvor nevyšiel mimo steny. */
export function placeOpening(spec: OpeningSpec, wallLength: number): Opening {
  const u0 = Math.min(Math.max(spec.position * wallLength - spec.width / 2, 0), wallLength - spec.width);
  return { kind: spec.kind, u0, u1: u0 + spec.width, v0: spec.sill, v1: spec.sill + spec.height };
}

/**
 * Z parametrov poskladá celý dom: steny podľa modulu strechy, otvory, drevenú konštrukciu
 * a strešné plochy. 3D scéna aj výpočty čítajú tento istý zoznam prvkov.
 * @throws ZodError pri neplatných parametroch.
 */
export function buildHouse(rawParams: HouseParams): BuildingElement[] {
  const p = HouseParamsSchema.parse(rawParams);
  const roof = ROOFS[p.roof.type];
  const timber = p.construction === "timber";

  const walls = ([0, 1, 2, 3] as const).flatMap((i) => {
    const outline = roof.wallOutline(i, p);
    if (!outline) return [];
    const len = i % 2 === 0 ? p.length : p.width;
    return [
      makeElement({
        id: `wall-${i}`,
        kind: "wall",
        label: WALL_LABELS[i],
        frame: wallFrame(i, p.length, p.width),
        outline,
        openings: p.openings.filter((o) => o.wall === i && o.width < len).map((o) => placeOpening(o, len)),
        profile: timber ? p.stud : null,
        plateLevels: roof.wallPlateLevels(p),
        solidThickness: timber ? 0 : MASONRY_THICKNESS,
      }),
    ];
  });

  return [...walls, ...roof.elements(p)];
}
