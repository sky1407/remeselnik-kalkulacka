import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_RATE_PER_KM, VAT_RATES } from "@/lib/calc/quote";
import type { ElementKind } from "@/lib/house/element";
import { PointSchema } from "@/lib/travel/maps";

const range = (min: number, max: number) => z.number().finite().min(min).max(max);

export const LABOR_UNITS = { m3: "€/m³", kg: "€/kg", m2: "€/m²" } as const;
export type LaborUnit = keyof typeof LABOR_UNITS;

/** Odporúčané rozsahy objemovej hmotnosti podľa ISOCELL – mimo nich aplikácia len upozorní. */
export const RECOMMENDED_DENSITY: Record<ElementKind, readonly [number, number]> = {
  ceiling: [28, 40],
  roof: [38, 65],
  "flat-roof": [38, 65],
  wall: [38, 65],
};

const density = range(15, 90);

const PlaceSchema = PointSchema.extend({ label: z.string().min(1).max(200) });

export const SettingsSchema = z.object({
  cellulose: z.object({
    bagKg: range(5, 30),
    bagPrice: range(0, 500),
    laborRate: range(0, 1000),
    laborUnit: z.enum(Object.keys(LABOR_UNITS) as [LaborUnit, ...LaborUnit[]]),
    m3PerHour: range(0.5, 20),
    looseThickness: range(0.05, 0.6),
    looseSettling: range(0, 0.3),
    density: z.object({ ceiling: density, roof: density, "flat-roof": density, wall: density }),
  }),
  travel: z.object({
    /** Dielňa / sklad – odkiaľ remeselník vyráža. */
    origin: PlaceSchema.nullable(),
    /** Adresa zákazky. */
    destination: PlaceSchema.nullable(),
    distanceKmOneWay: range(0, 1000),
    trips: z.number().int().min(1).max(100),
    /** Základná náhrada za km (amortizácia vozidla). */
    ratePerKm: range(0, 5),
    consumptionL100: range(0, 40),
    fuelType: z.enum(["diesel", "petrol95"]),
    /** Vlastná cena paliva; `null` = aktuálna priemerná cena v SR podľa ŠÚ SR. */
    fuelPriceOverride: range(0.5, 5).nullable(),
  }),
  vat: z.object({
    payer: z.boolean(),
    rate: z.union(VAT_RATES.map((r) => z.literal(r))),
  }),
});

export type Settings = z.infer<typeof SettingsSchema>;
export type CelluloseSettings = Settings["cellulose"];

/** Predvolené hodnoty – ceny sú UKÁŽKOVÉ, remeselník si ich prepíše na svoje. */
export const DEFAULT_SETTINGS: Settings = {
  cellulose: {
    bagKg: 15,
    bagPrice: 14,
    laborRate: 25,
    laborUnit: "m3",
    m3PerHour: 4,
    looseThickness: 0.3,
    looseSettling: 0.15,
    density: { ceiling: 32, roof: 45, "flat-roof": 45, wall: 55 },
  },
  travel: {
    origin: null,
    destination: null,
    distanceKmOneWay: 0,
    trips: 1,
    ratePerKm: DEFAULT_RATE_PER_KM,
    consumptionL100: 8,
    fuelType: "diesel",
    fuelPriceOverride: null,
  },
  vat: { payer: false, rate: 0.23 },
};

interface SettingsState extends Settings {
  setCellulose: (patch: Partial<Omit<CelluloseSettings, "density">>) => void;
  setDensity: (kind: ElementKind, value: number) => void;
  setTravel: (patch: Partial<Settings["travel"]>) => void;
  setVat: (patch: Partial<Settings["vat"]>) => void;
  reset: () => void;
}

const pickSettings = ({ cellulose, travel, vat }: Settings): Settings => ({ cellulose, travel, vat });

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set): SettingsState => {
      /** Jediné miesto zápisu – neplatný stav (napr. z rozbitého vstupu) sa nikdy neuloží. */
      const apply = (fn: (s: Settings) => Settings) =>
        set((s) => {
          const next = fn(pickSettings(s));
          return SettingsSchema.safeParse(next).success ? next : s;
        });

      return {
        ...DEFAULT_SETTINGS,
        setCellulose: (patch) => apply((s) => ({ ...s, cellulose: { ...s.cellulose, ...patch } })),
        setDensity: (kind, value) =>
          apply((s) => ({ ...s, cellulose: { ...s.cellulose, density: { ...s.cellulose.density, [kind]: value } } })),
        setTravel: (patch) => apply((s) => ({ ...s, travel: { ...s.travel, ...patch } })),
        setVat: (patch) => apply((s) => ({ ...s, vat: { ...s.vat, ...patch } })),
        reset: () => set(DEFAULT_SETTINGS),
      };
    },
    {
      name: "remeselnik-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: pickSettings,
      // Hydratuje sa až v prehliadači (useEffect), inak by sa serverový a klientsky HTML líšil.
      skipHydration: true,
      // Poškodené alebo podvrhnuté dáta v localStorage sa zahodia namiesto pádu aplikácie.
      merge: (persisted, current) => {
        const parsed = SettingsSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);
