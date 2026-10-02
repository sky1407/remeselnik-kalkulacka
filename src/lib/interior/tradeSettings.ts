import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const range = (min: number, max: number) => z.number().finite().min(min).max(max);
const price = range(0, 10_000);

/** Balený materiál: obsah balenia v jednotke materiálu a jeho cena bez DPH. */
const PackageSchema = z.object({ size: range(0.01, 10_000), price });

const TileSchema = z.object({
  /** Rozmery obkladačky v mm. */
  a: range(20, 3000),
  b: range(20, 3000),
  /** m² v jednom balíku (krabici). */
  boxM2: range(0.1, 10),
  pricePerM2: price,
});

export const PATTERN_WASTE = { straight: 0.1, diagonal: 0.15, herringbone: 0.15 } as const;
export type TilePattern = keyof typeof PATTERN_WASTE;

export const TradeSettingsSchema = z.object({
  painter: z.object({
    layers: z.number().int().min(1).max(5),
    /** Spotreba farby v l/m² na jednu vrstvu (0,14 ≈ výdatnosť 7 m²/l). */
    paintLPerM2: range(0.02, 1),
    paint: PackageSchema,
    primer: z.object({ enabled: z.boolean(), lPerM2: range(0.02, 1), pack: PackageSchema }),
    laborWall: price,
    laborCeiling: price,
    m2PerHour: range(1, 100),
    /** Fasáda: fasádna farba má inú výdatnosť aj cenu a práca je drahšia (lešenie, počasie). */
    facade: z.object({ lPerM2: range(0.05, 1), paint: PackageSchema, labor: price, m2PerHour: range(1, 100) }),
  }),
  tiler: z.object({
    wallTile: TileSchema,
    floorTile: TileSchema,
    pattern: z.enum(Object.keys(PATTERN_WASTE) as [TilePattern, ...TilePattern[]]),
    jointMm: range(1, 20),
    tileThicknessMm: range(3, 30),
    adhesiveKgPerM2: range(1, 15),
    adhesive: PackageSchema,
    grout: PackageSchema,
    primer: z.object({ lPerM2: range(0.02, 1), pack: PackageSchema }),
    waterproofing: z.object({ kgPerM2: range(0.5, 5), upstandM: range(0, 0.5), pack: PackageSchema }),
    laborWall: price,
    laborFloor: price,
    m2PerHour: range(0.2, 20),
  }),
  drywall: z.object({
    /** Osová vzdialenosť CD profilov v podhľade a CW profilov v predsadenej stene (m). */
    ceilingSpacing: range(0.3, 1),
    wallSpacing: range(0.3, 1),
    /** Dĺžka profilu v obchode (m). */
    profileLength: range(2, 6),
    profilePrice: price,
    /** Rozmer dosky v m² (1,25 × 2 m = 2,5 m²). */
    boardM2: range(0.5, 5),
    boardPrice: price,
    waste: range(0, 0.5),
    screwsPerM2: range(5, 40),
    screws: PackageSchema,
    /** Rozostup závesov na CD profile (m). */
    hangerSpacing: range(0.4, 1.5),
    hangerPrice: price,
    compoundKgPerM2: range(0.1, 2),
    compound: PackageSchema,
    laborCeiling: price,
    laborWall: price,
    m2PerHour: range(0.5, 20),
  }),
});

export type TradeSettings = z.infer<typeof TradeSettingsSchema>;
export type PainterSettings = TradeSettings["painter"];
export type TilerSettings = TradeSettings["tiler"];
export type DrywallSettings = TradeSettings["drywall"];

/** UKÁŽKOVÉ ceny a bežné spotreby z technických listov – remeselník si ich prepíše. */
export const DEFAULT_TRADE_SETTINGS: TradeSettings = {
  painter: {
    layers: 2,
    paintLPerM2: 0.14,
    paint: { size: 10, price: 35 },
    primer: { enabled: true, lPerM2: 0.1, pack: { size: 5, price: 15 } },
    laborWall: 3.5,
    laborCeiling: 4.5,
    m2PerHour: 15,
    facade: { lPerM2: 0.2, paint: { size: 15, price: 75 }, labor: 7, m2PerHour: 10 },
  },
  tiler: {
    wallTile: { a: 300, b: 600, boxM2: 1.44, pricePerM2: 18 },
    floorTile: { a: 600, b: 600, boxM2: 1.44, pricePerM2: 22 },
    pattern: "straight",
    jointMm: 3,
    tileThicknessMm: 9,
    adhesiveKgPerM2: 4,
    adhesive: { size: 25, price: 9 },
    grout: { size: 5, price: 12 },
    primer: { lPerM2: 0.15, pack: { size: 5, price: 15 } },
    waterproofing: { kgPerM2: 1.5, upstandM: 0.2, pack: { size: 7, price: 45 } },
    laborWall: 25,
    laborFloor: 22,
    m2PerHour: 1.2,
  },
  drywall: {
    ceilingSpacing: 0.5,
    wallSpacing: 0.625,
    profileLength: 4,
    profilePrice: 3.5,
    boardM2: 2.5,
    boardPrice: 8,
    waste: 0.1,
    screwsPerM2: 17,
    screws: { size: 1000, price: 12 },
    hangerSpacing: 0.9,
    hangerPrice: 0.4,
    compoundKgPerM2: 0.35,
    compound: { size: 25, price: 18 },
    laborCeiling: 18,
    laborWall: 16,
    m2PerHour: 2,
  },
};

type Plain = Record<string, unknown>;
const isPlain = (v: unknown): v is Plain => typeof v === "object" && v !== null && !Array.isArray(v);

/** Uložené hodnoty prekryjú predvolené – nové nastavenia v ďalšej verzii tak nezmažú staré ceny. */
export function mergeDeep<T>(base: T, override: unknown): T {
  if (!isPlain(base) || !isPlain(override)) return (override === undefined ? base : override) as T;
  const out: Plain = { ...base };
  for (const [k, v] of Object.entries(override)) if (k in base) out[k] = mergeDeep((base as Plain)[k], v);
  return out as T;
}

type Section = keyof TradeSettings;

interface TradeSettingsState extends TradeSettings {
  /** Zmení jednu sekciu; neplatný výsledok (napr. záporná cena) sa ignoruje. */
  update: <K extends Section>(section: K, fn: (s: TradeSettings[K]) => TradeSettings[K]) => void;
  reset: (section: Section) => void;
}

const pick = ({ painter, tiler, drywall }: TradeSettings): TradeSettings => ({ painter, tiler, drywall });

export const useTradeSettings = create<TradeSettingsState>()(
  persist(
    (set): TradeSettingsState => ({
      ...DEFAULT_TRADE_SETTINGS,
      update: (section, fn) =>
        set((s) => {
          const next = { ...pick(s), [section]: fn(s[section]) };
          return TradeSettingsSchema.safeParse(next).success ? next : s;
        }),
      reset: (section) => set({ [section]: DEFAULT_TRADE_SETTINGS[section] }),
    }),
    {
      name: "remeselnik-trade-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: pick,
      skipHydration: true,
      merge: (persisted, current) => {
        const parsed = TradeSettingsSchema.safeParse(mergeDeep(DEFAULT_TRADE_SETTINGS, persisted));
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);
