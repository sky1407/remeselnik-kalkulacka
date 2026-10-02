import { z } from "zod";
import { makeElement, type BuildingElement, type Frame3D } from "@/lib/house/element";
import type { Polygon } from "@/lib/house/geometry2d";
import { OpeningSpecSchema, placeOpening } from "@/lib/house/house";

const range = (min: number, max: number) => z.number().finite().min(min).max(max);

export const ROOM_LIMITS = {
  length: { min: 1, max: 15, step: 0.05 },
  width: { min: 1, max: 15, step: 0.05 },
  height: { min: 2, max: 5, step: 0.05 },
} as const;

export const RoomSpecSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(40),
  length: range(ROOM_LIMITS.length.min, ROOM_LIMITS.length.max),
  width: range(ROOM_LIMITS.width.min, ROOM_LIMITS.width.max),
  height: range(ROOM_LIMITS.height.min, ROOM_LIMITS.height.max),
  openings: z.array(OpeningSpecSchema).max(20),
  /** Výška obkladu na stenách v m (0 = bez obkladu). */
  tileHeight: range(0, 5),
  /** Mokrá zóna (kúpeľňa) – obkladač počíta hydroizoláciu. */
  wetZone: z.boolean(),
});

export type RoomSpec = z.infer<typeof RoomSpecSchema>;
export type RoomDimension = keyof typeof ROOM_LIMITS;

export const WALL_NAMES = ["A", "B", "C", "D"] as const;

/**
 * Vnútorné líce steny. Normála n = u × v smeruje do miestnosti – k tomu, kto stojí vo vnútri,
 * takže maľba, obklad aj sadrokartón sú na strane +n.
 */
function interiorFrame(id: string, { length: l, width: w, height: h }: RoomSpec): Frame3D {
  switch (id) {
    case "wall-0": return { origin: [-l / 2, 0, -w / 2], u: [1, 0, 0], v: [0, 1, 0] };
    case "wall-1": return { origin: [l / 2, 0, -w / 2], u: [0, 0, 1], v: [0, 1, 0] };
    case "wall-2": return { origin: [l / 2, 0, w / 2], u: [-1, 0, 0], v: [0, 1, 0] };
    case "wall-3": return { origin: [-l / 2, 0, w / 2], u: [0, 0, -1], v: [0, 1, 0] };
    case "floor": return { origin: [-l / 2, 0, w / 2], u: [1, 0, 0], v: [0, 0, -1] };
    case "ceiling": return { origin: [-l / 2, h, -w / 2], u: [1, 0, 0], v: [0, 0, 1] };
    default: throw new Error(`Neznáma plocha izby: ${id}`);
  }
}

const rect = (w: number, h: number): Polygon => [[0, 0], [w, 0], [w, h], [0, h]];

/**
 * Rozloží izbu na 4 steny, strop a podlahu s odpočtom okien a dverí.
 * Vracia rovnaký typ prvkov ako dom, takže 3D aj výpočty fungujú rovnako.
 * @throws ZodError pri neplatných rozmeroch.
 */
export function buildRoom(rawSpec: RoomSpec): BuildingElement[] {
  const spec = RoomSpecSchema.parse(rawSpec);
  const walls = ([0, 1, 2, 3] as const).map((i) => {
    const len = i % 2 === 0 ? spec.length : spec.width;
    const id = `wall-${i}`;
    return makeElement({
      id,
      kind: "wall",
      label: `Stena ${WALL_NAMES[i]}`,
      frame: interiorFrame(id, spec),
      outline: rect(len, spec.height),
      openings: spec.openings.filter((o) => o.wall === i && o.width < len).map((o) => placeOpening(o, len)),
      profile: null,
    });
  });

  const flat = (id: "floor" | "ceiling", label: string) =>
    makeElement({ id, kind: id, label, frame: interiorFrame(id, spec), outline: rect(spec.length, spec.width), profile: null });

  return [...walls, flat("ceiling", "Strop"), flat("floor", "Podlaha")];
}

/** Obvod izby v m – na sokel, rohové lišty a obvodové profily. */
export const roomPerimeter = (spec: Pick<RoomSpec, "length" | "width">): number => 2 * (spec.length + spec.width);
