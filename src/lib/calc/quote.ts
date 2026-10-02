import { z } from "zod";

/** Zákonná základná náhrada za 1 km osobným autom od 1. 1. 2026 (opatrenie MPSVR SR č. 447/2025 Z. z.). */
export const DEFAULT_RATE_PER_KM = 0.313;

/** Sadzby DPH platné na Slovensku od 1. 1. 2025. */
export const VAT_RATES = [0.23, 0.19, 0.05] as const;

const positive = z.number().finite().positive();
const nonNegative = z.number().finite().nonnegative();

export const MaterialSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.enum(["kg", "l", "ks", "m2", "bm"]),
  /** Spotreba jednotky na 1 m² a 1 vrstvu. */
  consumptionPerM2: positive,
  /** Obsah balenia v jednotkách `unit`. */
  packageSize: positive,
  /** Cena balenia v € bez DPH. */
  packagePrice: nonNegative,
  /** Stratné ako desatinné číslo (0.1 = 10 %). */
  waste: z.number().finite().min(0).max(1),
});

export const WorkItemSchema = z.object({
  label: z.string().min(1),
  area: positive,
  layers: z.number().int().positive(),
  material: MaterialSpecSchema.optional(),
  /** Základná sadzba práce v €/m² bez DPH (pred regionálnym koeficientom). */
  laborRatePerM2: nonNegative,
  /** Výkon v m²/h pre odhad času. */
  productivityM2PerHour: positive,
});

export const QuoteInputSchema = z.object({
  items: z.array(WorkItemSchema).min(1),
  /** Regionálny koeficient ceny práce (1 = základ). */
  regionCoefficient: positive,
  travel: z
    .object({
      distanceKmOneWay: nonNegative,
      trips: z.number().int().positive(),
      ratePerKm: nonNegative.default(DEFAULT_RATE_PER_KM),
      /** Palivo navyše k základnej náhrade (ako pri cestovných náhradach podľa zák. 283/2002 Z. z.). */
      fuel: z
        .object({ consumptionL100: z.number().finite().min(0).max(40), pricePerL: z.number().finite().min(0).max(5) })
        .optional(),
    })
    .optional(),
  vatPayer: z.boolean(),
  vatRate: z.union(VAT_RATES.map((r) => z.literal(r))),
});

export type MaterialSpec = z.infer<typeof MaterialSpecSchema>;
export type WorkItem = z.infer<typeof WorkItemSchema>;
export type QuoteInput = z.input<typeof QuoteInputSchema>;

export interface QuoteLine {
  kind: "material" | "labor" | "travel";
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalCents: number;
}

export interface Quote {
  lines: QuoteLine[];
  netCents: number;
  vatCents: number;
  grossCents: number;
  laborHours: number;
}

const toCents = (eur: number): number => Math.round(eur * 100);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Materiál zlúči podľa `id` naprieč položkami, aby sa balenia počítali zo súhrnnej spotreby
 * (rovnaká farba na steny aj strop = menej načatých vedier).
 */
function materialLines(items: readonly WorkItem[]): QuoteLine[] {
  const byId = new Map<string, { spec: MaterialSpec; quantity: number }>();
  for (const item of items) {
    if (!item.material) continue;
    const qty = item.area * item.layers * item.material.consumptionPerM2 * (1 + item.material.waste);
    const entry = byId.get(item.material.id);
    if (entry) entry.quantity += qty;
    else byId.set(item.material.id, { spec: item.material, quantity: qty });
  }

  return [...byId.values()].map(({ spec, quantity }) => {
    // Odrežie floating point šum (napr. 2.0000000001 by inak znamenalo balenie navyše).
    const packages = Math.ceil(round2(quantity / spec.packageSize));
    return {
      kind: "material",
      label: `${spec.name} (${round2(quantity)} ${spec.unit})`,
      quantity: packages,
      unit: "bal.",
      unitPrice: spec.packagePrice,
      totalCents: packages * toCents(spec.packagePrice),
    };
  });
}

/**
 * Vypočíta cenovú ponuku. Každý riadok sa zaokrúhli na centy samostatne, súčty sa robia
 * z celých centov – výsledok sedí s tým, čo uvidí zákazník na papieri.
 * @throws ZodError pri neplatnom vstupe.
 */
export function calculateQuote(rawInput: QuoteInput): Quote {
  const input = QuoteInputSchema.parse(rawInput);

  const labor = input.items.map((item): QuoteLine => {
    const unitPrice = round2(item.laborRatePerM2 * input.regionCoefficient);
    return {
      kind: "labor",
      label: item.label,
      quantity: round2(item.area),
      unit: "m²",
      unitPrice,
      totalCents: toCents(item.area * unitPrice),
    };
  });

  const travel: QuoteLine[] = [];
  if (input.travel && input.travel.distanceKmOneWay > 0) {
    const km = round2(input.travel.distanceKmOneWay * 2 * input.travel.trips);
    travel.push({
      kind: "travel",
      label: `Doprava (${input.travel.trips}× tam a späť)`,
      quantity: km,
      unit: "km",
      unitPrice: input.travel.ratePerKm,
      totalCents: toCents(km * input.travel.ratePerKm),
    });
    const fuel = input.travel.fuel;
    if (fuel && fuel.consumptionL100 > 0 && fuel.pricePerL > 0) {
      const liters = round2((km * fuel.consumptionL100) / 100);
      travel.push({
        kind: "travel",
        label: `Palivo (${fuel.consumptionL100} l/100 km)`,
        quantity: liters,
        unit: "l",
        unitPrice: fuel.pricePerL,
        totalCents: toCents(liters * fuel.pricePerL),
      });
    }
  }

  const lines = [...materialLines(input.items), ...labor, ...travel];
  const netCents = lines.reduce((sum, l) => sum + l.totalCents, 0);
  const vatCents = input.vatPayer ? Math.round(netCents * input.vatRate) : 0;
  const laborHours = input.items.reduce((h, i) => h + i.area / i.productivityM2PerHour, 0);

  return {
    lines,
    netCents,
    vatCents,
    grossCents: netCents + vatCents,
    laborHours: Math.round(laborHours * 10) / 10,
  };
}
