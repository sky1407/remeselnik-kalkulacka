import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { calculateQuote, type MaterialSpec, type QuoteInput } from "./quote";

const paint: MaterialSpec = {
  id: "paint-white",
  name: "Interiérová farba biela 15 kg",
  unit: "kg",
  consumptionPerM2: 0.2,
  packageSize: 15,
  packagePrice: 30,
  waste: 0.1,
};

const baseInput = (overrides: Partial<QuoteInput> = {}): QuoteInput => ({
  items: [
    { label: "Maľba stien", area: 46.8, layers: 2, material: paint, laborRatePerM2: 3, productivityM2PerHour: 10 },
    { label: "Maľba stropu", area: 20, layers: 2, material: paint, laborRatePerM2: 3.5, productivityM2PerHour: 8 },
  ],
  regionCoefficient: 0.8,
  travel: { distanceKmOneWay: 25, trips: 2 },
  vatPayer: true,
  vatRate: 0.23,
  ...overrides,
});

describe("calculateQuote", () => {
  it("vypočíta kompletnú ponuku s materiálom, prácou, dopravou a DPH", () => {
    const q = calculateQuote(baseInput());

    expect(q.lines.map((l) => [l.kind, l.quantity, l.totalCents])).toEqual([
      ["material", 2, 6000], // 66.8 m² × 2 × 0.2 × 1.1 = 29.39 kg → 2 vedrá
      ["labor", 46.8, 11232], // 3 × 0.8 = 2.40 €/m²
      ["labor", 20, 5600], // 3.5 × 0.8 = 2.80 €/m²
      ["travel", 100, 3130], // 25 km × 2 × 2 × 0.313
    ]);
    expect(q.netCents).toBe(25962);
    expect(q.vatCents).toBe(5971);
    expect(q.grossCents).toBe(31933);
    expect(q.laborHours).toBe(7.2);
  });

  it("zlúči rovnaký materiál naprieč položkami do spoločných balení", () => {
    const q = calculateQuote(baseInput());
    expect(q.lines.filter((l) => l.kind === "material")).toHaveLength(1);
  });

  it("nepridá balenie navyše kvôli floating point šumu", () => {
    // 75 m² × 1 × 0.2 × 1 = presne 15 kg = 1 balenie
    const q = calculateQuote(
      baseInput({
        items: [{ label: "x", area: 75, layers: 1, material: { ...paint, waste: 0 }, laborRatePerM2: 0, productivityM2PerHour: 1 }],
      }),
    );
    expect(q.lines[0].quantity).toBe(1);
  });

  it("neplatiteľ DPH nepripočíta daň", () => {
    const q = calculateQuote(baseInput({ vatPayer: false }));
    expect(q.vatCents).toBe(0);
    expect(q.grossCents).toBe(q.netCents);
  });

  it("vynechá dopravu pri nulovej vzdialenosti alebo bez zadania", () => {
    expect(calculateQuote(baseInput({ travel: undefined })).lines.some((l) => l.kind === "travel")).toBe(false);
    expect(
      calculateQuote(baseInput({ travel: { distanceKmOneWay: 0, trips: 1 } })).lines.some((l) => l.kind === "travel"),
    ).toBe(false);
  });

  it("položka bez materiálu účtuje len prácu", () => {
    const q = calculateQuote(
      baseInput({ items: [{ label: "Penetrácia", area: 10, layers: 1, laborRatePerM2: 1, productivityM2PerHour: 20 }] }),
    );
    expect(q.lines.map((l) => l.kind)).toEqual(["labor", "travel"]);
  });

  it("položka s nulovou cenou práce pridá len materiál", () => {
    const q = calculateQuote(
      baseInput({ travel: undefined, items: [{ label: "Penetrácia", area: 10, layers: 1, material: paint, laborRatePerM2: 0, productivityM2PerHour: 40 }] }),
    );
    expect(q.lines.map((l) => l.kind)).toEqual(["material"]);
  });

  it.each<[string, Partial<QuoteInput>]>([
    ["prázdne položky", { items: [] }],
    ["záporný koeficient", { regionCoefficient: -1 }],
    ["neexistujúca sadzba DPH", { vatRate: 0.2 as 0.23 }],
    ["desatinný počet ciest", { travel: { distanceKmOneWay: 10, trips: 1.5 } }],
  ])("odmietne neplatný vstup: %s", (_, overrides) => {
    expect(() => calculateQuote(baseInput(overrides))).toThrow(ZodError);
  });

  it("pripočíta palivo podľa spotreby a ceny za liter", () => {
    const q = calculateQuote(
      baseInput({ travel: { distanceKmOneWay: 25, trips: 2, fuel: { consumptionL100: 8, pricePerL: 1.95 } } }),
    );
    const fuel = q.lines.find((l) => l.unit === "l")!;
    expect(fuel.quantity).toBe(8); // 100 km × 8 l / 100
    expect(fuel.totalCents).toBe(1560);
  });

  it("nulová spotreba palivo nepridá", () => {
    const q = calculateQuote(
      baseInput({ travel: { distanceKmOneWay: 25, trips: 1, fuel: { consumptionL100: 0, pricePerL: 1.95 } } }),
    );
    expect(q.lines.filter((l) => l.kind === "travel")).toHaveLength(1);
  });
});
