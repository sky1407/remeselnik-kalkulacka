import { describe, expect, it } from "vitest";
import { generateFraming, type Member } from "./framing";
import { polygonArea, spanAt, subtractIntervals, type Polygon } from "./geometry2d";

const rect = (w: number, h: number): Polygon => [[0, 0], [w, 0], [w, h], [0, h]];
/** Štítová stena 8 m, výška k odkvapu 2,6 m, hrebeň 5 m. */
const gable: Polygon = [[0, 0], [8, 0], [8, 2.6], [4, 5], [0, 2.6]];

describe("geometry2d", () => {
  it("polygonArea počíta obdĺžnik aj štít", () => {
    expect(polygonArea(rect(4, 2.6))).toBeCloseTo(10.4);
    expect(polygonArea(gable)).toBeCloseTo(8 * 2.6 + (8 * 2.4) / 2);
  });

  it("spanAt nájde výšku štítu v danom mieste", () => {
    expect(spanAt(gable, 0, 2)).toEqual([0, 3.8]);
    const [u0, u1] = spanAt(gable, 1, 3.8)!;
    expect(u0).toBeCloseTo(2);
    expect(u1).toBeCloseTo(6);
    expect(spanAt(gable, 0, 9)).toBeNull();
  });

  it("subtractIntervals vyreže otvory a zahodí krátke zvyšky", () => {
    expect(subtractIntervals([0, 10], [[2, 3], [9.995, 11]], 0.01)).toEqual([[0, 2], [3, 9.995]]);
  });
});

const overlaps = (a: Member, r: { u0: number; u1: number; v0: number; v1: number }) =>
  a.u0 < r.u1 - 1e-9 && a.u1 > r.u0 + 1e-9 && a.v0 < r.v1 - 1e-9 && a.v1 > r.v0 + 1e-9;

describe("generateFraming", () => {
  const rafter = { width: 0.08, depth: 0.2, spacing: 0.9 };
  const stud = { width: 0.06, depth: 0.16, spacing: 0.625 };

  it("krokvy: krajné lícujú s okrajom, medzi nimi osová vzdialenosť 900 mm", () => {
    const f = generateFraming(rect(10, 5), { profile: rafter });
    expect(f.axes).toHaveLength(12);
    expect(f.axes[0]).toBeCloseTo(0.04);
    expect(f.axes[1] - f.axes[0]).toBeCloseTo(0.9);
    expect(f.axes.at(-1)).toBeCloseTo(9.96);
    expect(f.woodFraction).toBeCloseTo((12 * 0.08 * 5) / 50);
  });

  it("stena: stĺpiky sú medzi prahmi a neprekrývajú sa s nimi", () => {
    const f = generateFraming(rect(4, 2.6), { profile: stud, plateLevels: [0, 2.6] });
    const plates = f.members.filter((m) => m.role === "plate");
    const studs = f.members.filter((m) => m.role === "stud");
    expect(plates).toHaveLength(2);
    expect(studs.every((s) => Math.abs(s.v1 - s.v0 - 2.48) < 1e-9)).toBe(true);
    expect(studs.some((s) => plates.some((p) => overlaps(s, p)))).toBe(false);
  });

  it("okno: prvky ho obchádzajú, pribudne nadpražie, parapet a ostenia", () => {
    const win = { u0: 1, u1: 2, v0: 0.9, v1: 2.1 };
    const f = generateFraming(rect(4, 2.6), { profile: stud, openings: [win], plateLevels: [0, 2.6] });
    expect(f.members.some((m) => overlaps(m, win))).toBe(false);
    expect(f.members.filter((m) => m.role === "header")).toHaveLength(1);
    expect(f.members.filter((m) => m.role === "sill")).toHaveLength(1);
    expect(f.axes).toContain(0.97);
    expect(f.axes).toContain(2.03);
  });

  it("dvere na zemi nemajú parapet", () => {
    const door = { u0: 1, u1: 1.9, v0: 0, v1: 2 };
    const f = generateFraming(rect(4, 2.6), { profile: stud, openings: [door] });
    expect(f.members.filter((m) => m.role === "sill")).toHaveLength(0);
  });

  it("štít: žiadny stĺpik nevytŕča nad šikmý okraj", () => {
    const f = generateFraming(gable, { profile: stud, plateLevels: [0] });
    for (const m of f.members.filter((x) => x.role === "stud")) {
      const top = Math.min(spanAt(gable, 0, m.u0)![1], spanAt(gable, 0, m.u1)![1]);
      expect(m.v1).toBeLessThanOrEqual(top + 1e-9);
    }
  });

  it("podiel dreva zodpovedá teórii pre stĺpikovú stenu (cca 10–15 % s prahmi)", () => {
    const f = generateFraming(rect(10, 2.6), { profile: stud, plateLevels: [0, 2.6] });
    expect(f.woodFraction).toBeGreaterThan(0.1);
    expect(f.woodFraction).toBeLessThan(0.15);
  });

  it.each([
    { width: 0, depth: 0.2, spacing: 0.9 },
    { width: 0.08, depth: 0.2, spacing: 0.05 },
  ])("odmietne neplatný profil %o", (profile) => {
    expect(() => generateFraming(rect(4, 2.6), { profile })).toThrow(RangeError);
  });
});
