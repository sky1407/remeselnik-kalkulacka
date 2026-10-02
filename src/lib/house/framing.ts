import {
  bounds,
  polygonArea,
  rectArea,
  spanAt,
  subtractIntervals,
  type Interval,
  type Polygon,
  type Rect,
} from "./geometry2d";

/** Prierez a rozostup nosných prvkov (stĺpik, krokva, stropný trám) v metroch. */
export interface MemberProfile {
  /** Šírka prvku v rovine plochy (napr. 0,08 m pri krokve 80 × 200). */
  width: number;
  /** Hĺbka prvku = hrúbka dutiny pre izoláciu. */
  depth: number;
  /** Osová vzdialenosť prvkov. */
  spacing: number;
}

export interface FramingOptions {
  profile: MemberProfile;
  /** Otvory (okná, dvere) – prvky sa okolo nich prerušia a doplní sa nadpražie a parapet. */
  openings?: readonly Rect[];
  /** Výšky v, v ktorých ide vodorovný prah / väznica cez celú plochu. */
  plateLevels?: readonly number[];
}

/** Drevený prvok ako obdĺžnik v rovine plochy (jeho hĺbka je `profile.depth`). */
export interface Member extends Rect {
  role: "stud" | "plate" | "header" | "sill";
}

export interface Framing {
  members: Member[];
  /** Os každého zvislého prvku – na kótovanie rozostupu v 3D. */
  axes: number[];
  /** Podiel dreva v čistej ploche (0–1), z ktorého sa počíta objem dutín. */
  woodFraction: number;
}

/** Osi zvislých prvkov: krajné prvky lícujú s okrajom, medzi nimi pravidelný rozostup. */
function memberAxes(u0: number, u1: number, { width, spacing }: MemberProfile, forced: readonly number[]): number[] {
  const hw = width / 2;
  const first = u0 + hw;
  const last = u1 - hw;
  if (last < first) return [];

  const fixed = [first, last, ...forced].sort((a, b) => a - b);
  const regular: number[] = [];
  for (let u = first + spacing; u < last - width; u += spacing) {
    // Prvok, ktorý by sa prekrýval s krajným alebo ostením okna, sa vynechá.
    if (fixed.every((f) => Math.abs(f - u) >= width)) regular.push(u);
  }
  return [...new Set([...fixed, ...regular].map((u) => Math.round(u * 1e6) / 1e6))].sort((a, b) => a - b);
}

/**
 * Vygeneruje drevenú konštrukciu v konvexnej ploche: zvislé prvky v pravidelnom rozostupe,
 * prahy, ostenia, nadpražia a parapety. Podiel dreva sa počíta zo skutočných prvkov, nie odhadom.
 * @throws RangeError pri neplatnom profile.
 */
export function generateFraming(outline: Polygon, options: FramingOptions): Framing {
  const { profile, openings = [], plateLevels = [] } = options;
  const { width, depth, spacing } = profile;
  if (!(width > 0 && depth > 0 && spacing > width)) {
    throw new RangeError("Profil prvku musí mať kladné rozmery a rozostup väčší ako šírku prvku");
  }

  const hw = width / 2;
  const box = bounds(outline);
  const horizontal: Member[] = [];

  for (const level of plateLevels) {
    const v = Math.min(Math.max(level, box.v0 + hw), box.v1 - hw);
    const span = spanAt(outline, 1, v);
    if (span) horizontal.push({ role: "plate", u0: span[0], u1: span[1], v0: v - hw, v1: v + hw });
  }
  for (const o of openings) {
    horizontal.push({ role: "header", u0: o.u0, u1: o.u1, v0: o.v1, v1: o.v1 + width });
    if (o.v0 > box.v0 + width) horizontal.push({ role: "sill", u0: o.u0, u1: o.u1, v0: o.v0 - width, v1: o.v0 });
  }

  const jambs = openings.flatMap((o) => [o.u0 - hw, o.u1 + hw]);
  const axes = memberAxes(box.u0, box.u1, profile, jambs);

  const vertical: Member[] = axes.flatMap((u) => {
    // Pri šikmom okraji (štít) berieme kratší z dvoch okrajov prvku, aby nevytŕčal von.
    const a = spanAt(outline, 0, Math.max(u - hw, box.u0));
    const b = spanAt(outline, 0, Math.min(u + hw, box.u1));
    if (!a || !b) return [];
    const span: Interval = [Math.max(a[0], b[0]), Math.min(a[1], b[1])];
    const cuts = [...openings, ...horizontal]
      .filter((r) => r.u0 < u + hw && r.u1 > u - hw)
      .map((r): Interval => [r.v0, r.v1]);
    return subtractIntervals(span, cuts, 0.01).map(
      ([v0, v1]): Member => ({ role: "stud", u0: u - hw, u1: u + hw, v0, v1 }),
    );
  });

  const members = [...horizontal, ...vertical];
  const netArea = polygonArea(outline) - openings.reduce((s, o) => s + rectArea(o), 0);
  const woodArea = members.reduce((s, m) => s + rectArea(m), 0);

  return { members, axes, woodFraction: netArea > 0 ? Math.min(1, woodArea / netArea) : 0 };
}
