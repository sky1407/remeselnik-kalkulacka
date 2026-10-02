import { describe, expect, it } from "vitest";
import { DEFAULT_TRADE_SETTINGS, mergeDeep, TradeSettingsSchema, useTradeSettings } from "./tradeSettings";

describe("mergeDeep", () => {
  it("doplní chýbajúce nové nastavenia a zachová uložené ceny", () => {
    const stored = { painter: { laborWall: 5 }, unknown: { x: 1 } };
    const merged = mergeDeep(DEFAULT_TRADE_SETTINGS, stored);
    expect(merged.painter.laborWall).toBe(5);
    expect(merged.painter.paint).toEqual(DEFAULT_TRADE_SETTINGS.painter.paint);
    expect("unknown" in merged).toBe(false);
    expect(TradeSettingsSchema.safeParse(merged).success).toBe(true);
  });
});

describe("useTradeSettings", () => {
  it("uloží platnú zmenu a neplatnú ignoruje", () => {
    const { update } = useTradeSettings.getState();
    update("tiler", (t) => ({ ...t, laborFloor: 30 }));
    update("tiler", (t) => ({ ...t, jointMm: -1 }));
    expect(useTradeSettings.getState().tiler.laborFloor).toBe(30);
    expect(useTradeSettings.getState().tiler.jointMm).toBe(3);
    useTradeSettings.getState().reset("tiler");
    expect(useTradeSettings.getState().tiler).toEqual(DEFAULT_TRADE_SETTINGS.tiler);
  });

  it("predvolené hodnoty prejdú validáciou", () => {
    expect(TradeSettingsSchema.safeParse(DEFAULT_TRADE_SETTINGS).success).toBe(true);
  });
});
