import { describe, expect, it } from "vitest";
import { buildWorkItems, PAINTER, selectableKinds } from "./trades";

const room = { length: 5, width: 4, height: 2.6 };

describe("buildWorkItems", () => {
  it("sčíta vybrané steny do jednej položky a strop do druhej", () => {
    const items = buildWorkItems(PAINTER, room, ["wall-0", "wall-1", "ceiling"]);
    expect(items.map((i) => [i.label, i.area])).toEqual([
      ["Maľba stien 2×", 23.4],
      ["Maľba stropu 2×", 20],
    ]);
  });

  it("ignoruje plochy, ktoré remeslo nerobí (podlaha pre maliara)", () => {
    expect(buildWorkItems(PAINTER, room, ["floor"])).toEqual([]);
  });

  it("bez výberu nevráti nič", () => {
    expect(buildWorkItems(PAINTER, room, [])).toEqual([]);
  });
});

describe("selectableKinds", () => {
  it("maliar môže ťukať na steny a strop", () => {
    expect(selectableKinds(PAINTER)).toEqual(["wall", "ceiling"]);
  });
});
