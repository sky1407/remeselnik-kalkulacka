import { generateFraming, type Framing, type MemberProfile } from "./framing";
import { bounds, polygonArea, rectArea, spanAt, type Polygon, type Rect } from "./geometry2d";

export type Vec3 = readonly [number, number, number];

/**
 * Lokálna súradnicová sústava plochy. Normála n = u × v smeruje k vonkajšej vrstve (fasáda, krytina,
 * podhľad); nosné prvky a izolácia idú od roviny opačným smerom (−n).
 */
export interface Frame3D {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
}

export type ElementKind = "wall" | "roof" | "ceiling" | "flat-roof" | "floor";

/** Plochy, do ktorých sa fúka celulóza – podlaha medzi ne nepatrí. */
export type CelluloseKind = Exclude<ElementKind, "floor">;

export interface Opening extends Rect {
  kind: "window" | "door";
}

export interface BuildingElement {
  id: string;
  kind: ElementKind;
  label: string;
  frame: Frame3D;
  outline: Polygon;
  openings: Opening[];
  /** Čistá plocha bez otvorov v m². */
  netArea: number;
  /** Drevená konštrukcia; `null` = murovaná stena bez dutín. */
  framing: Framing | null;
  profile: MemberProfile | null;
  /** Hrúbka murovanej steny – len na vykreslenie. */
  solidThickness: number;
  /** Krytina / opláštenie s presahom; `offset` je posun po normále. */
  cover?: { outline: Polygon; offset: number };
}

export interface ElementInput {
  id: string;
  kind: ElementKind;
  label: string;
  frame: Frame3D;
  outline: Polygon;
  openings?: readonly Opening[];
  profile: MemberProfile | null;
  plateLevels?: readonly number[];
  solidThickness?: number;
  cover?: BuildingElement["cover"];
}

/**
 * Otvor sa zahodí, ak sa do plochy nezmestí aj s okolitými prvkami – pri zmenšovaní domu
 * posuvníkom tak nevznikne chyba, okno len dočasne zmizne.
 */
function fitsInside(outline: Polygon, o: Rect, margin: number): boolean {
  const b = bounds(outline);
  if (o.u0 < b.u0 + margin || o.u1 > b.u1 - margin || o.v0 < b.v0) return false;
  return [o.u0, o.u1].every((u) => {
    const span = spanAt(outline, 0, u);
    return span !== null && o.v1 <= span[1] - margin;
  });
}

export function makeElement(input: ElementInput): BuildingElement {
  const margin = input.profile ? input.profile.width * 2 : 0.1;
  const openings: Opening[] = [];
  for (const o of input.openings ?? []) {
    const clashes = openings.some((a) => o.u0 < a.u1 + margin && o.u1 > a.u0 - margin);
    if (!clashes && fitsInside(input.outline, o, margin)) openings.push(o);
  }
  const netArea = polygonArea(input.outline) - openings.reduce((s, o) => s + rectArea(o), 0);

  return {
    id: input.id,
    kind: input.kind,
    label: input.label,
    frame: input.frame,
    outline: input.outline,
    openings,
    netArea: Math.round(netArea * 100) / 100,
    framing: input.profile
      ? generateFraming(input.outline, { profile: input.profile, openings, plateLevels: input.plateLevels })
      : null,
    profile: input.profile,
    solidThickness: input.solidThickness ?? 0,
    cover: input.cover,
  };
}
