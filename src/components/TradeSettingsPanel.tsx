"use client";

import type { InteriorTrade } from "@/lib/interior/roomStore";
import {
  useTradeSettings,
  type DrywallSettings,
  type PainterSettings,
  type TilePattern,
  type TilerSettings,
  type TradeSettings,
} from "@/lib/interior/tradeSettings";
import { NumberField } from "./NumberField";
import { Section } from "./ui";

/** Popis jedného číselného poľa: odkiaľ čítať, ako zapísať a v akom rozsahu (v zobrazovaných jednotkách). */
interface Field<T> {
  label: string;
  unit: string;
  min: number;
  max: number;
  scale?: number;
  hint?: string;
  get: (s: T) => number;
  set: (s: T, v: number) => T;
}

const PAINTER_FIELDS: Field<PainterSettings>[] = [
  { label: "Cena práce – steny", unit: "€/m²", min: 0, max: 1000, get: (s) => s.laborWall, set: (s, v) => ({ ...s, laborWall: v }) },
  { label: "Cena práce – strop", unit: "€/m²", min: 0, max: 1000, get: (s) => s.laborCeiling, set: (s, v) => ({ ...s, laborCeiling: v }) },
  { label: "Počet vrstiev", unit: "×", min: 1, max: 5, get: (s) => s.layers, set: (s, v) => ({ ...s, layers: Math.round(v) }) },
  { label: "Spotreba farby", unit: "l/m²", min: 0.02, max: 1, hint: "na 1 vrstvu", get: (s) => s.paintLPerM2, set: (s, v) => ({ ...s, paintLPerM2: v }) },
  { label: "Balenie farby", unit: "l", min: 0.1, max: 100, get: (s) => s.paint.size, set: (s, v) => ({ ...s, paint: { ...s.paint, size: v } }) },
  { label: "Cena balenia farby", unit: "€", min: 0, max: 10000, get: (s) => s.paint.price, set: (s, v) => ({ ...s, paint: { ...s.paint, price: v } }) },
  { label: "Spotreba penetrácie", unit: "l/m²", min: 0.02, max: 1, get: (s) => s.primer.lPerM2, set: (s, v) => ({ ...s, primer: { ...s.primer, lPerM2: v } }) },
  { label: "Cena penetrácie", unit: "€", min: 0, max: 10000, hint: "za balenie", get: (s) => s.primer.pack.price, set: (s, v) => ({ ...s, primer: { ...s.primer, pack: { ...s.primer.pack, price: v } } }) },
  { label: "Výkon", unit: "m²/h", min: 1, max: 100, get: (s) => s.m2PerHour, set: (s, v) => ({ ...s, m2PerHour: v }) },
  { label: "Fasáda – cena práce", unit: "€/m²", min: 0, max: 1000, get: (s) => s.facade.labor, set: (s, v) => ({ ...s, facade: { ...s.facade, labor: v } }) },
  { label: "Fasádna farba – spotreba", unit: "l/m²", min: 0.05, max: 1, hint: "na 1 vrstvu", get: (s) => s.facade.lPerM2, set: (s, v) => ({ ...s, facade: { ...s.facade, lPerM2: v } }) },
  { label: "Fasádna farba – balenie", unit: "l", min: 0.1, max: 100, get: (s) => s.facade.paint.size, set: (s, v) => ({ ...s, facade: { ...s.facade, paint: { ...s.facade.paint, size: v } } }) },
  { label: "Fasádna farba – cena", unit: "€", min: 0, max: 10000, hint: "za balenie", get: (s) => s.facade.paint.price, set: (s, v) => ({ ...s, facade: { ...s.facade, paint: { ...s.facade.paint, price: v } } }) },
];

const tileFields = (key: "wallTile" | "floorTile", name: string): Field<TilerSettings>[] => [
  { label: `${name} – šírka`, unit: "mm", min: 20, max: 3000, get: (s) => s[key].a, set: (s, v) => ({ ...s, [key]: { ...s[key], a: v } }) },
  { label: `${name} – výška`, unit: "mm", min: 20, max: 3000, get: (s) => s[key].b, set: (s, v) => ({ ...s, [key]: { ...s[key], b: v } }) },
  { label: `${name} – balenie`, unit: "m²", min: 0.1, max: 10, get: (s) => s[key].boxM2, set: (s, v) => ({ ...s, [key]: { ...s[key], boxM2: v } }) },
  { label: `${name} – cena`, unit: "€/m²", min: 0, max: 10000, get: (s) => s[key].pricePerM2, set: (s, v) => ({ ...s, [key]: { ...s[key], pricePerM2: v } }) },
];

const TILER_FIELDS: Field<TilerSettings>[] = [
  { label: "Cena práce – obklad", unit: "€/m²", min: 0, max: 1000, get: (s) => s.laborWall, set: (s, v) => ({ ...s, laborWall: v }) },
  { label: "Cena práce – dlažba", unit: "€/m²", min: 0, max: 1000, get: (s) => s.laborFloor, set: (s, v) => ({ ...s, laborFloor: v }) },
  ...tileFields("wallTile", "Obklad"),
  ...tileFields("floorTile", "Dlažba"),
  { label: "Šírka škáry", unit: "mm", min: 1, max: 20, get: (s) => s.jointMm, set: (s, v) => ({ ...s, jointMm: v }) },
  { label: "Hrúbka obkladačky", unit: "mm", min: 3, max: 30, get: (s) => s.tileThicknessMm, set: (s, v) => ({ ...s, tileThicknessMm: v }) },
  { label: "Spotreba lepidla", unit: "kg/m²", min: 1, max: 15, get: (s) => s.adhesiveKgPerM2, set: (s, v) => ({ ...s, adhesiveKgPerM2: v }) },
  { label: "Cena vreca lepidla", unit: "€", min: 0, max: 10000, hint: "vrece 25 kg", get: (s) => s.adhesive.price, set: (s, v) => ({ ...s, adhesive: { ...s.adhesive, price: v } }) },
  { label: "Cena škárovačky", unit: "€", min: 0, max: 10000, hint: "balenie 5 kg", get: (s) => s.grout.price, set: (s, v) => ({ ...s, grout: { ...s.grout, price: v } }) },
  { label: "Hydroizolácia", unit: "kg/m²", min: 0.5, max: 5, hint: "2 vrstvy", get: (s) => s.waterproofing.kgPerM2, set: (s, v) => ({ ...s, waterproofing: { ...s.waterproofing, kgPerM2: v } }) },
  { label: "Sokel hydroizolácie", unit: "cm", min: 0, max: 50, scale: 100, get: (s) => s.waterproofing.upstandM, set: (s, v) => ({ ...s, waterproofing: { ...s.waterproofing, upstandM: v } }) },
  { label: "Výkon", unit: "m²/h", min: 0.2, max: 20, get: (s) => s.m2PerHour, set: (s, v) => ({ ...s, m2PerHour: v }) },
];

const DRYWALL_FIELDS: Field<DrywallSettings>[] = [
  { label: "Cena práce – podhľad", unit: "€/m²", min: 0, max: 1000, get: (s) => s.laborCeiling, set: (s, v) => ({ ...s, laborCeiling: v }) },
  { label: "Cena práce – stena", unit: "€/m²", min: 0, max: 1000, get: (s) => s.laborWall, set: (s, v) => ({ ...s, laborWall: v }) },
  { label: "Rozostup CD (podhľad)", unit: "mm", min: 300, max: 1000, scale: 1000, get: (s) => s.ceilingSpacing, set: (s, v) => ({ ...s, ceilingSpacing: v }) },
  { label: "Rozostup CW (stena)", unit: "mm", min: 300, max: 1000, scale: 1000, get: (s) => s.wallSpacing, set: (s, v) => ({ ...s, wallSpacing: v }) },
  { label: "Dĺžka profilu", unit: "m", min: 2, max: 6, get: (s) => s.profileLength, set: (s, v) => ({ ...s, profileLength: v }) },
  { label: "Cena profilu", unit: "€/ks", min: 0, max: 10000, get: (s) => s.profilePrice, set: (s, v) => ({ ...s, profilePrice: v }) },
  { label: "Doska", unit: "m²", min: 0.5, max: 5, hint: "1,25 × 2 m = 2,5", get: (s) => s.boardM2, set: (s, v) => ({ ...s, boardM2: v }) },
  { label: "Cena dosky", unit: "€/ks", min: 0, max: 10000, get: (s) => s.boardPrice, set: (s, v) => ({ ...s, boardPrice: v }) },
  { label: "Stratné dosiek", unit: "%", min: 0, max: 50, scale: 100, get: (s) => s.waste, set: (s, v) => ({ ...s, waste: v }) },
  { label: "Rozostup závesov", unit: "mm", min: 400, max: 1500, scale: 1000, get: (s) => s.hangerSpacing, set: (s, v) => ({ ...s, hangerSpacing: v }) },
  { label: "Cena závesu", unit: "€/ks", min: 0, max: 10000, get: (s) => s.hangerPrice, set: (s, v) => ({ ...s, hangerPrice: v }) },
  { label: "Skrutky", unit: "ks/m²", min: 5, max: 40, get: (s) => s.screwsPerM2, set: (s, v) => ({ ...s, screwsPerM2: v }) },
  { label: "Tmel", unit: "kg/m²", min: 0.1, max: 2, get: (s) => s.compoundKgPerM2, set: (s, v) => ({ ...s, compoundKgPerM2: v }) },
  { label: "Výkon", unit: "m²/h", min: 0.5, max: 20, get: (s) => s.m2PerHour, set: (s, v) => ({ ...s, m2PerHour: v }) },
];

const PATTERNS: Record<TilePattern, string> = {
  straight: "Rovno (stratné 10 %)",
  diagonal: "Diagonálne (15 %)",
  herringbone: "Rybia kosť (15 %)",
};

function Fields<K extends keyof TradeSettings>({ section, fields }: { section: K; fields: Field<TradeSettings[K]>[] }) {
  const values = useTradeSettings((s) => s[section]);
  const update = useTradeSettings((s) => s.update);
  return fields.map((f) => (
    <NumberField
      key={f.label}
      label={f.label}
      value={f.get(values)}
      scale={f.scale}
      min={f.min}
      max={f.max}
      unit={f.unit}
      hint={f.hint}
      onCommit={(v) => update(section, (s) => f.set(s, v))}
    />
  ));
}

/** Ceny a spotreby pre zvolené remeslo v interiéri. */
export function TradeSettingsPanel({ trade }: { trade: InteriorTrade }) {
  const pattern = useTradeSettings((s) => s.tiler.pattern);
  const primerEnabled = useTradeSettings((s) => s.painter.primer.enabled);
  const update = useTradeSettings((s) => s.update);
  const reset = useTradeSettings((s) => s.reset);

  const section = trade === "painter" ? "painter" : trade === "tiler" ? "tiler" : "drywall";

  return (
    <Section title="Moje ceny a spotreby">
      {trade === "painter" && (
        <>
          <Fields section="painter" fields={PAINTER_FIELDS} />
          <label className="col-span-2 flex min-h-12 items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={primerEnabled}
              onChange={(e) => update("painter", (s) => ({ ...s, primer: { ...s.primer, enabled: e.target.checked } }))}
              className="h-6 w-6 accent-green-600"
            />
            Penetrácia pred maľbou
          </label>
        </>
      )}
      {trade === "tiler" && (
        <>
          <label className="col-span-2 flex flex-col gap-1 text-sm text-stone-600">
            Kladenie
            <select
              value={pattern}
              onChange={(e) => update("tiler", (s) => ({ ...s, pattern: e.target.value as TilePattern }))}
              className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-base font-semibold text-stone-900"
            >
              {(Object.keys(PATTERNS) as TilePattern[]).map((p) => (
                <option key={p} value={p}>
                  {PATTERNS[p]}
                </option>
              ))}
            </select>
          </label>
          <Fields section="tiler" fields={TILER_FIELDS} />
        </>
      )}
      {trade === "drywall" && <Fields section="drywall" fields={DRYWALL_FIELDS} />}
      <button
        type="button"
        onClick={() => window.confirm("Vrátiť ceny tohto remesla na predvolené?") && reset(section)}
        className="col-span-2 min-h-12 rounded-lg border border-stone-300 text-sm font-medium text-stone-600"
      >
        Obnoviť predvolené hodnoty
      </button>
    </Section>
  );
}
