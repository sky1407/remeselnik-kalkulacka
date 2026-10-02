import { describe, expect, it } from "vitest";
import { parseFuelJsonStat, recentWeekCodes } from "./fuel";

/** Skrátená reálna odpoveď DATAcube (sp0207ts, 36. týždeň 2026). */
const datacube = (weeks: Record<string, number>, value: (number | null)[]) => ({
  id: ["sp0207ts_tyz", "sp0207ts_ukaz", "sp0207ts_data"],
  size: [Object.keys(weeks).length, 2, 1],
  dimension: {
    sp0207ts_tyz: {
      category: {
        index: weeks,
        label: Object.fromEntries(Object.keys(weeks).map((k) => [k, `${Number(k.slice(4))}. týždeň`])),
      },
    },
    sp0207ts_ukaz: { category: { index: { UKAZ01: 0, UKAZ04: 1 } } },
    sp0207ts_data: { category: { index: { NUM_VALUE: 0 } } },
  },
  value,
});

describe("parseFuelJsonStat", () => {
  it("prečíta benzín 95 a naftu z reálnej odpovede", () => {
    expect(parseFuelJsonStat(datacube({ "202636": 0 }, [1.774, 1.908]))).toEqual({
      petrol95: 1.774,
      diesel: 1.908,
      period: "36. týždeň",
    });
  });

  it("vyberie najnovší týždeň, ktorý má obe ceny", () => {
    const json = datacube({ "202636": 0, "202635": 1, "202637": 2 }, [1.774, 1.908, 1.76, 1.9, 1.78, null]);
    expect(parseFuelJsonStat(json).period).toBe("36. týždeň");
  });

  it("zvládne hodnoty ako objekt (riedky JSON-stat)", () => {
    expect(parseFuelJsonStat({ ...datacube({ "202636": 0 }, []), value: { "0": 1.7, "1": 1.9 } }).diesel).toBe(1.9);
  });

  it("odmietne chybovú odpoveď API", () => {
    expect(() => parseFuelJsonStat({ status: 400, status_message: "Too many results!" })).toThrow();
  });

  it("odmietne odpoveď bez dát", () => {
    expect(() => parseFuelJsonStat(datacube({ "202636": 0 }, [null, null]))).toThrow(/benzínu aj nafty/);
  });
});

describe("recentWeekCodes", () => {
  it("vráti aktuálny a predchádzajúce ISO týždne", () => {
    expect(recentWeekCodes(new Date("2026-10-02T10:00:00Z"), 3)).toEqual(["202640", "202639", "202638"]);
  });

  it("správne prejde cez prelom roka (53. týždeň 2026)", () => {
    expect(recentWeekCodes(new Date("2027-01-06T10:00:00Z"), 2)).toEqual(["202701", "202653"]);
  });
});
