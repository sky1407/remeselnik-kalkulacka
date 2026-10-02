/** Bod v lokálnych súradniciach plochy: u = vodorovne pozdĺž plochy, v = kolmo (hore / po spáde). */
export type Vec2 = readonly [number, number];

/** Konvexný polygón (obdĺžnik, štít, trojuholník) v poradí proti smeru hodinových ručičiek. */
export type Polygon = readonly Vec2[];

/** Osovo zarovnaný obdĺžnik – otvor (okno, dvere) alebo pás dreva. */
export interface Rect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export type Interval = readonly [number, number];

const EPS = 1e-9;

/** Plocha polygónu (shoelace). */
export function polygonArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export const rectArea = (r: Rect): number => (r.u1 - r.u0) * (r.v1 - r.v0);

export function bounds(poly: Polygon): Rect {
  const us = poly.map((p) => p[0]);
  const vs = poly.map((p) => p[1]);
  return { u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) };
}

/**
 * Prienik priamky so súradnicou `axis` = `value` s konvexným polygónom.
 * @param axis 0 = zvislá priamka u = value (vráti rozsah v), 1 = vodorovná v = value (vráti rozsah u)
 */
export function spanAt(poly: Polygon, axis: 0 | 1, value: number): Interval | null {
  const other = axis === 0 ? 1 : 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const lo = Math.min(a[axis], b[axis]);
    const hi = Math.max(a[axis], b[axis]);
    if (value < lo - EPS || value > hi + EPS) continue;
    if (Math.abs(b[axis] - a[axis]) < EPS) {
      min = Math.min(min, a[other], b[other]);
      max = Math.max(max, a[other], b[other]);
    } else {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      const x = a[other] + t * (b[other] - a[other]);
      min = Math.min(min, x);
      max = Math.max(max, x);
    }
  }
  return max - min > EPS ? [min, max] : null;
}

/** Odčíta zoznam intervalov od intervalu; vráti zvyšné kúsky dlhšie ako `minLength`. */
export function subtractIntervals(base: Interval, cuts: readonly Interval[], minLength = 0): Interval[] {
  let pieces: Interval[] = [base];
  for (const [c0, c1] of cuts) {
    pieces = pieces.flatMap(([p0, p1]): Interval[] => {
      if (c1 <= p0 || c0 >= p1) return [[p0, p1]];
      const out: Interval[] = [];
      if (c0 > p0) out.push([p0, c0]);
      if (c1 < p1) out.push([c1, p1]);
      return out;
    });
  }
  return pieces.filter(([a, b]) => b - a > minLength + EPS);
}
