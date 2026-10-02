"use client";

import type { ReactNode } from "react";
import { num } from "@/lib/format";
import { ROOF_TYPES, ROOFS, type RoofType } from "@/lib/house/roofs";
import { DIMENSION_LIMITS, SPACING_LIMITS, useHouseStore, type Dimension } from "@/lib/houseStore";

/** Siluety striech – remeselník spozná tvar rýchlejšie ako text. */
const ROOF_ICONS: Record<RoofType, ReactNode> = {
  flat: <path d="M4 14h32M6 14v12h28V14" />,
  gable: <path d="M3 16 20 5l17 11M7 14v12h26V14" />,
  aframe: <path d="M5 28 20 4l15 24zM16 28v-7h8v7" />,
};

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-stone-600">{label}</legend>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-sm font-semibold transition-colors ${
                active ? "border-green-600 bg-green-50 text-green-800" : "border-stone-200 bg-white text-stone-700"
              }`}
            >
              {o.icon && (
                <svg viewBox="0 0 40 30" className="h-7 w-10" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" aria-hidden>
                  {o.icon}
                </svg>
              )}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-baseline justify-between text-sm text-stone-600">
        {label}
        <span className="text-base font-bold text-stone-900 tabular-nums">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-10 w-full accent-green-600"
      />
    </label>
  );
}

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "length", label: "Dĺžka domu" },
  { key: "width", label: "Šírka domu" },
  { key: "wallHeight", label: "Výška stien" },
];

/** Ovládanie parametrov domu – každá zmena sa hneď prejaví v 3D aj vo výpočte. */
export function HouseControls() {
  const params = useHouseStore((s) => s.params);
  const setDimension = useHouseStore((s) => s.setDimension);
  const setRoofType = useHouseStore((s) => s.setRoofType);
  const setPitch = useHouseStore((s) => s.setPitch);
  const setConstruction = useHouseStore((s) => s.setConstruction);
  const setSpacing = useHouseStore((s) => s.setSpacing);

  const roof = ROOFS[params.roof.type];
  const timber = params.construction === "timber";

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        label="Strecha"
        value={params.roof.type}
        onChange={setRoofType}
        options={ROOF_TYPES.map((t) => ({ value: t, label: ROOFS[t].label, icon: ROOF_ICONS[t] }))}
      />
      <Segmented
        label="Stavba"
        value={params.construction}
        onChange={setConstruction}
        options={[
          { value: "timber", label: "Drevostavba" },
          { value: "masonry", label: "Murovaný" },
        ]}
      />

      <div className="flex flex-col gap-3">
        {DIMENSIONS.filter((d) => !(d.key === "wallHeight" && params.roof.type === "aframe")).map((d) => (
          <Slider
            key={d.key}
            label={d.label}
            value={params[d.key]}
            {...DIMENSION_LIMITS[d.key]}
            display={`${num.format(params[d.key])} m`}
            onChange={(v) => setDimension(d.key, v)}
          />
        ))}
        {roof.pitch && (
          <Slider
            label="Sklon strechy"
            value={params.roof.pitchDeg}
            min={roof.pitch.min}
            max={roof.pitch.max}
            step={1}
            display={`${params.roof.pitchDeg}°`}
            onChange={setPitch}
          />
        )}
        <Slider
          label={params.roof.type === "flat" ? "Osová vzd. stropníc" : "Osová vzd. krokiev"}
          value={params.rafter.spacing}
          {...SPACING_LIMITS}
          display={`${Math.round(params.rafter.spacing * 1000)} mm`}
          onChange={(v) => setSpacing("rafter", v)}
        />
        {timber && (
          <Slider
            label="Osová vzd. stĺpikov"
            value={params.stud.spacing}
            {...SPACING_LIMITS}
            display={`${Math.round(params.stud.spacing * 1000)} mm`}
            onChange={(v) => setSpacing("stud", v)}
          />
        )}
      </div>
    </div>
  );
}
