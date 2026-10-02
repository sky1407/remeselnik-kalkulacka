import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/lib/calc/quote";
import { makeElement, type ElementKind } from "@/lib/house/element";
import type { Polygon } from "@/lib/house/geometry2d";
import { DEFAULT_SETTINGS, type CelluloseSettings } from "@/lib/settings";
import { celluloseFor, celluloseWorkItems, isCelluloseTarget } from "./cellulose";

const DEFAULT_CELLULOSE = DEFAULT_SETTINGS.cellulose;

const rect = (w: number, h: number): Polygon => [[0, 0], [w, 0], [w, h], [0, h]];
const frame = { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 1, 0] } as const;

const element = (kind: ElementKind, w: number, h: number, depth: number) =>
  makeElement({ id: kind, kind, label: kind, frame, outline: rect(w, h), profile: { width: 0.08, depth, spacing: 0.9 } });

describe("celluloseFor", () => {
  it("šikmá strecha 120 m², krokvy 80 × 240 mm à 900 mm: odpočíta skutočný objem dreva", () => {
    const r = celluloseFor(element("roof", 12, 10, 0.24), DEFAULT_CELLULOSE);
    expect(r.woodFraction).toBeCloseTo(0.1); // 15 krokiev × 0,08 m × 10 m / 120 m²
    expect(r.volumeM3).toBe(25.92); // 28,8 m³ − 10 % dreva
    expect(r.kg).toBe(1166.4); // × 45 kg/m³
  });

  it("voľné fúkanie na strop: drevo len do výšky trámov, nad nimi plná vrstva + 15 % na sadanie", () => {
    const r = celluloseFor(element("ceiling", 10, 8, 0.2), DEFAULT_CELLULOSE);
    expect(r.thickness).toBe(0.3);
    expect(r.volumeM3).toBe(25.83); // (80 × 0,3 − 80 × 0,096 × 0,2) × 1,15
    expect(r.density).toBe(32);
  });

  it("murovanú stenu odmietne", () => {
    const wall = makeElement({ id: "w", kind: "wall", label: "Stena", frame, outline: rect(5, 3), profile: null });
    expect(isCelluloseTarget(wall)).toBe(false);
    expect(() => celluloseFor(wall, DEFAULT_CELLULOSE)).toThrow(RangeError);
  });
});

describe("celluloseWorkItems + calculateQuote", () => {
  it("vrecia sa počítajú zo súčtu kg všetkých plôch a práca z m³", () => {
    const results = [element("roof", 12, 10, 0.24), element("wall", 10, 2.6, 0.16)].map((e) =>
      celluloseFor(e, DEFAULT_CELLULOSE),
    );
    const totalKg = results.reduce((s, r) => s + r.kg, 0);
    const totalM3 = results.reduce((s, r) => s + r.volumeM3, 0);

    const q = calculateQuote({
      items: celluloseWorkItems(results, DEFAULT_CELLULOSE),
      regionCoefficient: 1,
      vatPayer: false,
      vatRate: 0.23,
    });

    const material = q.lines.filter((l) => l.kind === "material");
    expect(material).toHaveLength(1);
    expect(material[0].quantity).toBe(Math.ceil(totalKg / 15));
    const laborCents = q.lines.filter((l) => l.kind === "labor").reduce((s, l) => s + l.totalCents, 0);
    expect(laborCents / 100).toBeCloseTo(totalM3 * 25, 0);
    expect(q.laborHours).toBeCloseTo(totalM3 / 4, 1);
  });

  it.each<[CelluloseSettings["laborUnit"], (r: ReturnType<typeof celluloseFor>) => number]>([
    ["m3", (r) => r.volumeM3 * 30],
    ["kg", (r) => r.kg * 30],
    ["m2", (r) => r.element.netArea * 30],
  ])("cena práce v jednotke %s", (laborUnit, expected) => {
    const s = { ...DEFAULT_CELLULOSE, laborRate: 30, laborUnit };
    const r = celluloseFor(element("roof", 12, 10, 0.24), s);
    const q = calculateQuote({ items: celluloseWorkItems([r], s), regionCoefficient: 1, vatPayer: false, vatRate: 0.23 });
    const labor = q.lines.find((l) => l.kind === "labor")!;
    expect(labor.totalCents / 100).toBeCloseTo(expected(r), 0);
  });

  it("vlastná objemová hmotnosť zmení hmotnosť aj počet vriec", () => {
    const s = { ...DEFAULT_CELLULOSE, density: { ...DEFAULT_CELLULOSE.density, roof: 50 } };
    expect(celluloseFor(element("roof", 12, 10, 0.24), s).kg).toBe(1296); // 25,92 m³ × 50
  });
});
