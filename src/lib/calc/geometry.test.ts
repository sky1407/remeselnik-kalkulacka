import { describe, expect, it } from "vitest";
import { netArea, rectRoomSurfaces, type Surface } from "./geometry";

const wall = (overrides: Partial<Surface> = {}): Surface => ({
  id: "w",
  kind: "wall",
  width: 4,
  height: 2.6,
  openings: [],
  ...overrides,
});

describe("netArea", () => {
  it("vráti hrubú plochu bez otvorov", () => {
    expect(netArea(wall())).toBe(10.4);
  });

  it("odpočíta okno a dvere", () => {
    const area = netArea(wall({ openings: [{ width: 1.2, height: 1.5 }, { width: 0.8, height: 2 }] }));
    expect(area).toBe(7);
  });

  it("odstráni floating point šum", () => {
    expect(netArea(wall({ width: 0.1, height: 0.3 }))).toBe(0.03);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])("odmietne neplatný rozmer %s", (v) => {
    expect(() => netArea(wall({ width: v }))).toThrow(RangeError);
  });

  it("odmietne otvor s neplatným rozmerom", () => {
    expect(() => netArea(wall({ openings: [{ width: 0, height: 1 }] }))).toThrow(RangeError);
  });

  it("odmietne otvory väčšie ako plocha", () => {
    expect(() => netArea(wall({ openings: [{ width: 4, height: 2.6 }] }))).toThrow(/väčšie/);
  });
});

describe("rectRoomSurfaces", () => {
  it("vytvorí 4 steny, strop a podlahu so správnymi rozmermi", () => {
    const s = rectRoomSurfaces({ length: 5, width: 4, height: 2.6 });
    expect(s.map((x) => x.id)).toEqual(["wall-0", "wall-1", "wall-2", "wall-3", "ceiling", "floor"]);
    expect(s.filter((x) => x.kind === "wall").map(netArea)).toEqual([13, 10.4, 13, 10.4]);
    expect(netArea(s[4])).toBe(20);
  });

  it("priradí otvory správnej stene", () => {
    const s = rectRoomSurfaces({
      length: 5,
      width: 4,
      height: 2.6,
      wallOpenings: { 1: [{ width: 0.8, height: 2 }] },
    });
    expect(netArea(s[1])).toBe(8.8);
    expect(s[0].openings).toHaveLength(0);
  });

  it("odmietne neplatnú výšku miestnosti", () => {
    expect(() => rectRoomSurfaces({ length: 5, width: 4, height: 0 })).toThrow(RangeError);
  });
});
