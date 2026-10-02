import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, useSettingsStore } from "./settings";

describe("useSettingsStore", () => {
  beforeEach(() => useSettingsStore.getState().reset());

  it("uloží vlastnú cenu práce a hustotu", () => {
    const s = useSettingsStore.getState();
    s.setCellulose({ laborRate: 32, laborUnit: "kg" });
    s.setDensity("roof", 48);
    const next = useSettingsStore.getState();
    expect(next.cellulose.laborRate).toBe(32);
    expect(next.cellulose.laborUnit).toBe("kg");
    expect(next.cellulose.density.roof).toBe(48);
  });

  it.each([
    () => useSettingsStore.getState().setCellulose({ bagPrice: -5 }),
    () => useSettingsStore.getState().setDensity("wall", 500),
    () => useSettingsStore.getState().setTravel({ trips: 1.5 }),
    () => useSettingsStore.getState().setCellulose({ laborRate: Number.NaN }),
  ])("neplatnú hodnotu ignoruje (%#)", (action) => {
    action();
    const { cellulose, travel, vat } = useSettingsStore.getState();
    expect({ cellulose, travel, vat }).toEqual(DEFAULT_SETTINGS);
  });
});
