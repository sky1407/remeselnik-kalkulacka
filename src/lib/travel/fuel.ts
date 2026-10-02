import { z } from "zod";
import { USER_AGENT } from "./maps";

/**
 * Týždenné priemerné ceny palív v SR zo Štatistického úradu SR (DATAcube, dataset sp0207ts).
 * Oficiálne otvorené dáta vo formáte JSON-stat – bez scrapingu a bez API kľúča.
 */
const DATACUBE_URL = "https://data.statistics.sk/api/v2/dataset/sp0207ts";
const INDICATORS = { petrol95: "UKAZ01", diesel: "UKAZ04" } as const;
const TIMEOUT_MS = 15_000;

export type FuelType = keyof typeof INDICATORS;

export interface FuelPrices {
  petrol95: number;
  diesel: number;
  /** Popis obdobia, napr. „36. týždeň (31. 8. 2026 - 6. 9. 2026)“. */
  period: string;
  source: "susr" | "fallback";
}

/** Posledné overené hodnoty – použijú sa, keď DATAcube neodpovedá (stáva sa to často). */
export const FALLBACK_FUEL: FuelPrices = {
  petrol95: 1.774,
  diesel: 1.908,
  period: "36. týždeň (31. 8. 2026 - 6. 9. 2026)",
  source: "fallback",
};

/** ISO týždeň (pondelok = začiatok, 1. týždeň obsahuje 4. január) – tak ho číslujú aj na ŠÚ SR. */
function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7) };
}

/** Kódy posledných týždňov (RRRRTT) – ŠÚ SR zverejňuje s oneskorením, API neexistujúce kódy vynechá. */
export function recentWeekCodes(now: Date, count = 8): string[] {
  return Array.from({ length: count }, (_, i) => {
    const { year, week } = isoWeek(new Date(now.getTime() - i * 7 * 86_400_000));
    return `${year}${String(week).padStart(2, "0")}`;
  });
}

const CategorySchema = z.object({
  index: z.record(z.string(), z.number().int()),
  label: z.record(z.string(), z.string()).optional(),
});

const JsonStatSchema = z.object({
  id: z.array(z.string()),
  size: z.array(z.number().int()),
  dimension: z.record(z.string(), z.object({ category: CategorySchema })),
  value: z.union([z.array(z.number().nullable()), z.record(z.string(), z.number().nullable())]),
});

/**
 * Z JSON-stat odpovede vyberie najnovší týždeň, ktorý má cenu benzínu aj nafty.
 * @throws Error pri neočakávanom formáte alebo chýbajúcich dátach.
 */
export function parseFuelJsonStat(json: unknown): Omit<FuelPrices, "source"> {
  const data = JsonStatSchema.parse(json);
  const weekDim = data.id.find((d) => d.endsWith("_tyz"));
  const indicatorDim = data.id.find((d) => d.endsWith("_ukaz"));
  if (!weekDim || !indicatorDim) throw new Error("JSON-stat bez dimenzie týždňa alebo ukazovateľa");

  // Index hodnoty v plochom poli = súčet (index kategórie × krok dimenzie), row-major podľa `id`.
  const strides = data.size.map((_, i) => data.size.slice(i + 1).reduce((a, b) => a * b, 1));
  const valueAt = (coords: Record<string, number>): number | null => {
    const flat = data.id.reduce((sum, dim, i) => sum + (coords[dim] ?? 0) * strides[i], 0);
    const v = Array.isArray(data.value) ? data.value[flat] : data.value[String(flat)];
    return typeof v === "number" && v > 0 ? v : null;
  };

  const weeks = data.dimension[weekDim].category;
  const indicators = data.dimension[indicatorDim].category.index;
  const petrolIdx = indicators[INDICATORS.petrol95];
  const dieselIdx = indicators[INDICATORS.diesel];
  if (petrolIdx === undefined || dieselIdx === undefined) throw new Error("Chýba ukazovateľ benzínu alebo nafty");

  for (const code of Object.keys(weeks.index).sort().reverse()) {
    const w = weeks.index[code];
    const petrol95 = valueAt({ [weekDim]: w, [indicatorDim]: petrolIdx });
    const diesel = valueAt({ [weekDim]: w, [indicatorDim]: dieselIdx });
    if (petrol95 && diesel) return { petrol95, diesel, period: weeks.label?.[code] ?? code };
  }
  throw new Error("V odpovedi nie je týždeň s cenami benzínu aj nafty");
}

/** Stiahne aktuálne ceny; výsledok sa cachuje na deň (ŠÚ SR aktualizuje raz týždenne). */
export async function fetchFuelPrices(now = new Date()): Promise<FuelPrices> {
  const url = `${DATACUBE_URL}/${recentWeekCodes(now).join(",")}/${Object.values(INDICATORS).join(",")}?lang=sk`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) throw new Error(`DATAcube vrátil ${res.status}`);
  return { ...parseFuelJsonStat(await res.json()), source: "susr" };
}

/** Cena paliva do ponuky: vlastná cena remeselníka má prednosť pred priemerom SR. */
export function effectiveFuelPrice(override: number | null, type: FuelType, market: FuelPrices | null): number {
  return override ?? (market ?? FALLBACK_FUEL)[type];
}
