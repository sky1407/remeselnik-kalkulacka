import { create } from "zustand";
import { DEFAULT_HOUSE, type HouseParams } from "@/lib/house/house";
import { ROOFS, type RoofType } from "@/lib/house/roofs";

export type ViewLayer = "exterior" | "structure";
export type Dimension = "length" | "width" | "wallHeight";
export type ProfileKey = "stud" | "rafter";

/** Hranice posuvníkov – rovnaké ako v `HouseParamsSchema`, aby UI nikdy nevyrobilo neplatný dom. */
export const DIMENSION_LIMITS: Record<Dimension, { min: number; max: number; step: number }> = {
  length: { min: 4, max: 20, step: 0.1 },
  width: { min: 4, max: 14, step: 0.1 },
  wallHeight: { min: 2.2, max: 4, step: 0.05 },
};

export const SPACING_LIMITS = { min: 0.4, max: 1.2, step: 0.025 } as const;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface HouseState {
  params: HouseParams;
  layer: ViewLayer;
  /** ID vybraných prvkov z `buildHouse`; neexistujúce ID (napr. po zmene strechy) sa ignorujú. */
  selected: readonly string[];
  /** Počítadlo požiadaviek na vycentrovanie kamery – každá zmena = nové napasovanie domu do pohľadu. */
  fitRequest: number;
  requestFit: () => void;
  setDimension: (key: Dimension, value: number) => void;
  setRoofType: (type: RoofType) => void;
  setPitch: (deg: number) => void;
  setConstruction: (c: HouseParams["construction"]) => void;
  setSpacing: (key: ProfileKey, meters: number) => void;
  setLayer: (layer: ViewLayer) => void;
  toggleElement: (id: string) => void;
}

export const useHouseStore = create<HouseState>()((set) => ({
  params: DEFAULT_HOUSE,
  layer: "exterior",
  selected: [],
  fitRequest: 0,
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
  setDimension: (key, value) => {
    if (!Number.isFinite(value)) return;
    const { min, max } = DIMENSION_LIMITS[key];
    set((s) => ({ params: { ...s.params, [key]: clamp(value, min, max) } }));
  },
  setRoofType: (type) =>
    set((s) => ({
      params: {
        ...s.params,
        roof: { ...s.params.roof, type, pitchDeg: ROOFS[type].pitch?.default ?? s.params.roof.pitchDeg },
      },
      // Iná strecha = iná výška domu, preto sa pohľad znova napasuje.
      fitRequest: s.fitRequest + 1,
    })),
  setPitch: (deg) =>
    set((s) => {
      const range = ROOFS[s.params.roof.type].pitch;
      if (!range || !Number.isFinite(deg)) return s;
      return { params: { ...s.params, roof: { ...s.params.roof, pitchDeg: clamp(deg, range.min, range.max) } } };
    }),
  setConstruction: (construction) => set((s) => ({ params: { ...s.params, construction } })),
  setSpacing: (key, meters) => {
    if (!Number.isFinite(meters)) return;
    set((s) => ({
      params: { ...s.params, [key]: { ...s.params[key], spacing: clamp(meters, SPACING_LIMITS.min, SPACING_LIMITS.max) } },
    }));
  },
  setLayer: (layer) => set({ layer }),
  // Po výbere plochy sa prepne na konštrukciu, aby remeselník hneď videl polia medzi krokvami.
  toggleElement: (id) =>
    set((s) =>
      s.selected.includes(id)
        ? { selected: s.selected.filter((x) => x !== id) }
        : { selected: [...s.selected, id], layer: "structure" },
    ),
}));
