import { describe, expect, it } from "vitest";
import { calculateQuote, type WorkItem } from "@/lib/calc/quote";
import { drywallFraming, drywallItems } from "./drywall";
import { painterItems } from "./painter";
import { buildRoom, type RoomSpec } from "./room";
import { groutKgPerM2, tileBand, tilerItems } from "./tiler";
import { jobItems } from "./trades";
import { DEFAULT_TRADE_SETTINGS } from "./tradeSettings";

const bathroom: RoomSpec = {
  id: "r1",
  name: "Kúpeľňa",
  length: 2.5,
  width: 2,
  height: 2.6,
  openings: [
    { wall: 2, kind: "door", position: 0.5, width: 0.8, height: 2, sill: 0 },
    { wall: 0, kind: "window", position: 0.5, width: 0.6, height: 0.6, sill: 1.6 },
  ],
  tileHeight: 2,
  wetZone: true,
};
const elements = buildRoom(bathroom);
const ALL_WALLS = ["wall-0", "wall-1", "wall-2", "wall-3"];

const quote = (items: WorkItem[]) => calculateQuote({ items, regionCoefficient: 1, vatPayer: false, vatRate: 0.23 });
const line = (items: WorkItem[], name: RegExp) => quote(items).lines.find((l) => name.test(l.label))!;

describe("maliar", () => {
  const s = DEFAULT_TRADE_SETTINGS.painter;

  it("steny + strop: spoločná farba na vrstvy a penetrácia bez riadku práce", () => {
    const items = painterItems({ elements, selected: [...ALL_WALLS, "ceiling"] }, s);
    expect(items.map((i) => [i.label, i.area])).toEqual([
      ["Maľba stien 2×", 21.44], // 23,4 m² − dvere 1,6 − okno 0,36
      ["Maľba stropu 2×", 5],
      ["Penetrácia", 26.44],
    ]);
    const q = quote(items);
    // (21,44 + 5) m² × 2 vrstvy × 0,14 l × 1,05 = 7,77 l → 1 vedro 10 l
    expect(q.lines.find((l) => l.label.startsWith("Farba"))!.quantity).toBe(1);
    expect(q.lines.filter((l) => l.kind === "labor")).toHaveLength(2);
  });

  it("bez výberu nič", () => {
    expect(painterItems({ elements, selected: [] }, s)).toEqual([]);
  });
});

describe("obkladač", () => {
  const s = DEFAULT_TRADE_SETTINGS.tiler;

  it("pás obkladu odpočíta dvere len do výšky obkladu a okno nad pásom ignoruje", () => {
    expect(tileBand(elements[2], 2).area).toBe(2.5 * 2 - 0.8 * 2);
    // okno 1,6–2,2 m zasahuje do pásu 0–2 m len 0,4 m
    expect(tileBand(elements[0], 2).area).toBe(5 - 0.6 * 0.4);
  });

  it("škárovačka podľa vzorca výrobcov", () => {
    expect(groutKgPerM2(300, 600, 9, 3)).toBeCloseTo(0.216);
  });

  it("celá kúpeľňa: obklad, dlažba, lepidlo, škárovačka, penetrácia a hydroizolácia", () => {
    const items = tilerItems({ room: bathroom, elements, selected: [...ALL_WALLS, "floor"] }, s);
    const wallArea = 5 - 0.24 + 4 + (5 - 1.6) + 4;
    expect(items.find((i) => i.label.startsWith("Obklad"))!.area).toBeCloseTo(wallArea);
    expect(items.find((i) => i.label === "Dlažba")!.area).toBe(5);
    expect(items.find((i) => i.label === "Hydroizolácia")!.area).toBe(5 + 9 * 0.2);

    // obklad 16,16 m² × 1,1 stratné / 1,44 m² = 12,3 → 13 balíkov
    expect(line(items, /^Obklad 300×600/).quantity).toBe(13);
    // lepidlo (16,16 + 5) × 4 kg = 84,6 kg → 4 vrecia po 25 kg
    expect(line(items, /^Lepidlo/).quantity).toBe(4);
  });

  it("bez mokrej zóny nie je hydroizolácia, nulová výška = len dlažba", () => {
    const dry = { ...bathroom, wetZone: false, tileHeight: 0 };
    const items = tilerItems({ room: dry, elements: buildRoom(dry), selected: [...ALL_WALLS, "floor"] }, s);
    expect(items.map((i) => i.label)).toEqual(["Dlažba", "Škárovačka", "Lepidlo", "Penetrácia"]);
  });
});

describe("sadrokartonista", () => {
  const s = DEFAULT_TRADE_SETTINGS.drywall;
  const living: RoomSpec = { ...bathroom, length: 5, width: 4, openings: [{ wall: 0, kind: "window", position: 0.5, width: 1.5, height: 1.5, sill: 0.9 }] };
  const els = buildRoom(living);

  it("podhľad 5 × 4 m: CD profily à 500 mm z reálnej konštrukcie, UD po obvode, závesy", () => {
    const framing = drywallFraming(els.find((e) => e.id === "ceiling")!, s);
    expect(framing.axes).toHaveLength(11); // 0,03 … 4,97 m
    const items = drywallItems({ elements: els, selected: ["ceiling"] }, s);
    const q = quote(items);
    // 11 CD × 4 m = 44 bm × 1,05 / 4 m = 11,55 → 12 ks
    expect(q.lines.find((l) => l.label.startsWith("Profil CD"))!.quantity).toBe(12);
    // UD 18 bm × 1,05 / 4 = 4,7 → 5 ks
    expect(q.lines.find((l) => l.label.startsWith("Profil UD"))!.quantity).toBe(5);
    // 11 CD × ceil(4 / 0,9) = 55 závesov
    expect(q.lines.find((l) => l.label.startsWith("Rýchlozáves"))!.quantity).toBe(55);
    // 20 m² × 1,1 / 2,5 = 8,8 → 9 dosiek
    expect(q.lines.find((l) => l.label.startsWith("Sadrokartónová"))!.quantity).toBe(9);
  });

  it("predsadená stena s oknom: CW sa preruší, pribudne nadpražie a parapet, UW hore a dole", () => {
    const wall = els.find((e) => e.id === "wall-0")!;
    const framing = drywallFraming(wall, s);
    expect(framing.members.filter((m) => m.role === "plate")).toHaveLength(2);
    expect(framing.members.filter((m) => m.role === "header")).toHaveLength(1);
    const items = drywallItems({ elements: els, selected: ["wall-0"] }, s);
    expect(items[0]).toMatchObject({ label: "Predsadená stena – montáž", area: 13 - 2.25 });
    expect(items.map((i) => i.label)).toContain("UW profily");
  });

  it("podlahu ignoruje", () => {
    expect(drywallItems({ elements: els, selected: ["floor"] }, s)).toEqual([]);
  });
});

describe("jobItems", () => {
  it("spojí izby, pridá ich názov a farbu zráta spolu", () => {
    const living: RoomSpec = { ...bathroom, id: "r2", name: "Obývačka", length: 5, width: 4, openings: [] };
    const items = jobItems(
      "painter",
      [
        { room: bathroom, elements, selected: ["ceiling"] },
        { room: living, elements: buildRoom(living), selected: ["ceiling"] },
      ],
      DEFAULT_TRADE_SETTINGS,
    );
    expect(items.map((i) => i.label)).toEqual([
      "Kúpeľňa – Maľba stropu 2×",
      "Kúpeľňa – Penetrácia",
      "Obývačka – Maľba stropu 2×",
      "Obývačka – Penetrácia",
    ]);
    expect(quote(items).lines.filter((l) => l.label.startsWith("Farba"))).toHaveLength(1);
  });
});
