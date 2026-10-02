/** Typ plochy v miestnosti – určuje, ktoré práce sa na ňu dajú aplikovať. */
export type SurfaceKind = "wall" | "ceiling" | "floor";

/** Otvor v ploche (okno, dvere) v metroch. */
export interface Opening {
  width: number;
  height: number;
}

/** Obdĺžniková plocha v metroch, z ktorej sa odpočítavajú otvory. */
export interface Surface {
  id: string;
  kind: SurfaceKind;
  width: number;
  height: number;
  openings: readonly Opening[];
}

/** Parametrická obdĺžniková miestnosť v metroch. Otvory sú priradené k stenám podľa indexu 0–3. */
export interface RectRoom {
  length: number;
  width: number;
  height: number;
  wallOpenings?: Partial<Record<0 | 1 | 2 | 3, readonly Opening[]>>;
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} musí byť kladné číslo, dostal som: ${value}`);
  }
}

/** Zaokrúhli m² na 2 desatinné miesta, aby sa neprenášal šum z floating point. */
export function roundArea(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Čistá plocha po odpočítaní otvorov v m².
 * @throws RangeError pri neplatných rozmeroch alebo ak otvory presahujú plochu.
 */
export function netArea(surface: Surface): number {
  assertPositive(surface.width, `Šírka plochy ${surface.id}`);
  assertPositive(surface.height, `Výška plochy ${surface.id}`);

  const gross = surface.width * surface.height;
  const openings = surface.openings.reduce((sum, o, i) => {
    assertPositive(o.width, `Šírka otvoru ${i + 1} v ${surface.id}`);
    assertPositive(o.height, `Výška otvoru ${i + 1} v ${surface.id}`);
    return sum + o.width * o.height;
  }, 0);

  if (openings >= gross) {
    throw new RangeError(`Otvory v ${surface.id} sú väčšie alebo rovné ako samotná plocha`);
  }
  return roundArea(gross - openings);
}

/** Rozloží obdĺžnikovú miestnosť na 4 steny, strop a podlahu. */
export function rectRoomSurfaces(room: RectRoom): Surface[] {
  assertPositive(room.length, "Dĺžka miestnosti");
  assertPositive(room.width, "Šírka miestnosti");
  assertPositive(room.height, "Výška miestnosti");

  const wallWidths = [room.length, room.width, room.length, room.width] as const;
  const walls = wallWidths.map(
    (w, i): Surface => ({
      id: `wall-${i}`,
      kind: "wall",
      width: w,
      height: room.height,
      openings: room.wallOpenings?.[i as 0 | 1 | 2 | 3] ?? [],
    }),
  );

  return [
    ...walls,
    { id: "ceiling", kind: "ceiling", width: room.length, height: room.width, openings: [] },
    { id: "floor", kind: "floor", width: room.length, height: room.width, openings: [] },
  ];
}
