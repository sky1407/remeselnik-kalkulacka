import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { BuildingElement, Vec3 } from "./element";
import { polygonArea } from "./geometry2d";
import { buildHouse, DEFAULT_HOUSE, type HouseParams } from "./house";
import { ridgeHeight } from "./roofs";

const house = (patch: Partial<HouseParams> = {}, roof: Partial<HouseParams["roof"]> = {}) =>
  buildHouse({ ...DEFAULT_HOUSE, ...patch, roof: { ...DEFAULT_HOUSE.roof, ...roof } });

const byId = (els: BuildingElement[], id: string) => els.find((e) => e.id === id)!;

/** Bod lokálnych súradníc (u, v) prevedený do 3D. */
const toWorld = ({ frame: f }: BuildingElement, u: number, v: number): Vec3 =>
  [0, 1, 2].map((k) => f.origin[k] + f.u[k] * u + f.v[k] * v) as unknown as Vec3;

describe("buildHouse – sedlová strecha", () => {
  const els = house();

  it("obsahuje 4 steny, 2 strešné roviny a strop", () => {
    expect(els.map((e) => e.id)).toEqual(["wall-0", "wall-1", "wall-2", "wall-3", "roof-front", "roof-back", "ceiling"]);
  });

  it("štítová stena má päťuholník a odpočíta okno", () => {
    const rise = 4 * Math.tan((35 * Math.PI) / 180);
    const wall = byId(els, "wall-1");
    expect(wall.outline).toHaveLength(5);
    expect(wall.netArea).toBeCloseTo(8 * 2.8 + (8 * rise) / 2 - 1 * 1.4, 1);
  });

  it("strešné roviny sa stretnú v hrebeni nad stredom domu", () => {
    for (const id of ["roof-front", "roof-back"]) {
      const roof = byId(els, id);
      const [, y, z] = toWorld(roof, 0, roof.outline[2][1]);
      expect(y).toBeCloseTo(ridgeHeight(DEFAULT_HOUSE));
      expect(z).toBeCloseTo(0);
    }
  });

  it("predná stena má dvere a dve okná, každé s nadpražím", () => {
    const wall = byId(els, "wall-0");
    expect(wall.openings.map((o) => o.kind).sort()).toEqual(["door", "window", "window"]);
    expect(wall.framing!.members.filter((m) => m.role === "header")).toHaveLength(3);
  });
});

describe("buildHouse – moduly striech", () => {
  it("áčková: bez pozdĺžnych stien, štíty sú trojuholníky, sklon sa obmedzí na min. 50°", () => {
    const els = house({}, { type: "aframe", pitchDeg: 35 });
    expect(els.map((e) => e.id)).toEqual(["wall-1", "wall-3", "roof-front", "roof-back"]);
    expect(byId(els, "wall-1").outline).toHaveLength(3);
    expect(ridgeHeight({ ...DEFAULT_HOUSE, roof: { ...DEFAULT_HOUSE.roof, type: "aframe", pitchDeg: 35 } }))
      .toBeCloseTo(4 * Math.tan((50 * Math.PI) / 180));
  });

  it("rovná: 4 obdĺžnikové steny a plochá strecha s krytinou nad stropnicami", () => {
    const els = house({}, { type: "flat" });
    expect(els.filter((e) => e.kind === "wall").every((w) => w.outline.length === 4)).toBe(true);
    const roof = byId(els, "flat-roof");
    expect(roof.netArea).toBe(80);
    expect(roof.cover!.offset).toBeLessThan(-DEFAULT_HOUSE.rafter.depth);
    expect(polygonArea(roof.cover!.outline)).toBeCloseTo(11 * 9);
  });
});

describe("buildHouse – konštrukcia a otvory", () => {
  it("murovaný dom: steny bez dutín, krov ostáva drevený", () => {
    const els = house({ construction: "masonry" });
    expect(els.filter((e) => e.kind === "wall").every((w) => w.framing === null && w.solidThickness > 0)).toBe(true);
    expect(byId(els, "roof-front").framing).not.toBeNull();
  });

  it("pri malom dome sa prekrývajúce otvory vynechajú namiesto chyby", () => {
    const wall = byId(house({ length: 4 }), "wall-0");
    expect(wall.openings.length).toBeLessThan(3);
    for (const [i, a] of wall.openings.entries()) {
      for (const b of wall.openings.slice(i + 1)) expect(a.u1 <= b.u0 || b.u1 <= a.u0).toBe(true);
    }
  });

  it("odmietne neplatné parametre", () => {
    expect(() => house({ length: 1 })).toThrow(ZodError);
    expect(() => house({ rafter: { width: 0.5, depth: 0.2, spacing: 0.6 } })).toThrow(ZodError);
  });
});
