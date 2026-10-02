import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { BuildingElement } from "@/lib/house/element";
import { buildRoom, type RoomSpec } from "./room";

const bathroom: RoomSpec = {
  id: "r1",
  name: "Kúpeľňa",
  length: 2.5,
  width: 2,
  height: 2.6,
  openings: [{ wall: 2, kind: "door", position: 0.5, width: 0.8, height: 2, sill: 0 }],
  tileHeight: 2,
  wetZone: true,
};

const normal = ({ frame: { u, v } }: BuildingElement) => [
  u[1] * v[2] - u[2] * v[1],
  u[2] * v[0] - u[0] * v[2],
  u[0] * v[1] - u[1] * v[0],
];

const center = (el: BuildingElement) => {
  const [w, h] = [el.outline[2][0], el.outline[2][1]];
  return [0, 1, 2].map((k) => el.frame.origin[k] + (el.frame.u[k] * w) / 2 + (el.frame.v[k] * h) / 2);
};

describe("buildRoom", () => {
  const els = buildRoom(bathroom);

  it("vytvorí 4 steny, strop a podlahu", () => {
    expect(els.map((e) => e.id)).toEqual(["wall-0", "wall-1", "wall-2", "wall-3", "ceiling", "floor"]);
  });

  it("odpočíta dvere zo steny C a plochy sedia", () => {
    expect(els.map((e) => e.netArea)).toEqual([6.5, 5.2, 6.5 - 1.6, 5.2, 5, 5]);
  });

  it("každá plocha má normálu otočenú do stredu izby a leží na jej obvode", () => {
    for (const el of els) {
      const c = center(el);
      const n = normal(el);
      const toCenter = [0 - c[0], 1.3 - c[1], 0 - c[2]];
      expect(n[0] * toCenter[0] + n[1] * toCenter[1] + n[2] * toCenter[2]).toBeGreaterThan(0);
    }
    expect(center(els[1])[0]).toBeCloseTo(1.25);
    expect(center(els[4])[1]).toBeCloseTo(2.6);
  });

  it("odmietne nezmyselné rozmery", () => {
    expect(() => buildRoom({ ...bathroom, height: 0.5 })).toThrow(ZodError);
    expect(() => buildRoom({ ...bathroom, name: "  " })).toThrow(ZodError);
  });
});
