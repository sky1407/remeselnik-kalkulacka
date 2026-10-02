"use client";

import type { CelluloseKind } from "@/lib/house/element";
import { VAT_RATES } from "@/lib/calc/quote";
import { LABOR_UNITS, RECOMMENDED_DENSITY, useSettingsStore, type LaborUnit } from "@/lib/settings";
import { NumberField } from "./NumberField";
import { Section } from "./ui";

const DENSITY_LABELS: Record<CelluloseKind, string> = {
  ceiling: "Strop – voľné fúkanie",
  roof: "Šikmá strecha",
  "flat-roof": "Plochá strecha",
  wall: "Stena drevostavby",
};

/** Vlastné ceny a technické hodnoty pre fúkanú celulózu – ukladajú sa v zariadení. */
export function SettingsPanel() {
  const cellulose = useSettingsStore((s) => s.cellulose);
  const setCellulose = useSettingsStore((s) => s.setCellulose);
  const setDensity = useSettingsStore((s) => s.setDensity);
  const reset = useSettingsStore((s) => s.reset);

  return (
    <div className="flex flex-col gap-3">
      <Section title="Moje ceny">
        <NumberField
          label="Cena vreca"
          value={cellulose.bagPrice}
          min={0}
          max={500}
          unit="€"
          hint="bez DPH"
          onCommit={(bagPrice) => setCellulose({ bagPrice })}
        />
        <NumberField
          label="Hmotnosť vreca"
          value={cellulose.bagKg}
          min={5}
          max={30}
          unit="kg"
          hint="ISOCELL 15 kg"
          onCommit={(bagKg) => setCellulose({ bagKg })}
        />
        <NumberField
          label="Cena práce"
          value={cellulose.laborRate}
          min={0}
          max={1000}
          unit={LABOR_UNITS[cellulose.laborUnit]}
          hint="bez DPH"
          onCommit={(laborRate) => setCellulose({ laborRate })}
        />
        <label className="flex flex-col gap-1 text-sm text-stone-600">
          Účtujem prácu za
          <select
            value={cellulose.laborUnit}
            onChange={(e) => setCellulose({ laborUnit: e.target.value as LaborUnit })}
            className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-lg font-semibold text-stone-900"
          >
            <option value="m3">m³ objemu</option>
            <option value="kg">kg materiálu</option>
            <option value="m2">m² plochy</option>
          </select>
        </label>
        <NumberField
          label="Výkon fúkania"
          value={cellulose.m3PerHour}
          min={0.5}
          max={20}
          unit="m³/h"
          onCommit={(m3PerHour) => setCellulose({ m3PerHour })}
        />
      </Section>

      <Section title="Objemová hmotnosť a rezervy">
        {(Object.keys(DENSITY_LABELS) as CelluloseKind[]).map((kind) => {
          const [lo, hi] = RECOMMENDED_DENSITY[kind];
          const v = cellulose.density[kind];
          return (
            <NumberField
              key={kind}
              label={DENSITY_LABELS[kind]}
              value={v}
              min={15}
              max={90}
              unit="kg/m³"
              hint={`odporúčané ${lo}–${hi}`}
              warning={v < lo || v > hi ? `Mimo odporúčania ${lo}–${hi} kg/m³` : null}
              onCommit={(value) => setDensity(kind, value)}
            />
          );
        })}
        <NumberField
          label="Hrúbka na strop"
          value={cellulose.looseThickness}
          scale={1000}
          min={50}
          max={600}
          unit="mm"
          onCommit={(looseThickness) => setCellulose({ looseThickness })}
        />
        <NumberField
          label="Rezerva na sadanie"
          value={cellulose.looseSettling}
          scale={100}
          min={0}
          max={30}
          unit="%"
          hint="len voľné fúkanie"
          onCommit={(looseSettling) => setCellulose({ looseSettling })}
        />
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Vrátiť všetky ceny a nastavenia na predvolené hodnoty?")) reset();
          }}
          className="col-span-2 min-h-12 rounded-lg border border-stone-300 text-sm font-medium text-stone-600"
        >
          Obnoviť predvolené hodnoty
        </button>
      </Section>
    </div>
  );
}

/** DPH platí pre všetky remeslá – preto samostatná sekcia. */
export function VatPanel() {
  const vat = useSettingsStore((s) => s.vat);
  const setVat = useSettingsStore((s) => s.setVat);
  return (
    <Section title="DPH">
      <label className="col-span-2 flex min-h-12 items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={vat.payer}
          onChange={(e) => setVat({ payer: e.target.checked })}
          className="h-6 w-6 accent-green-600"
        />
        Som platiteľ DPH
      </label>
      {vat.payer && (
        <label className="col-span-2 flex flex-col gap-1 text-sm text-stone-600">
          Sadzba DPH
          <select
            value={vat.rate}
            onChange={(e) => setVat({ rate: Number(e.target.value) as (typeof VAT_RATES)[number] })}
            className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-lg font-semibold text-stone-900"
          >
            {VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {Math.round(r * 100)} %
              </option>
            ))}
          </select>
        </label>
      )}
    </Section>
  );
}
