"use client";

import type { ReactNode } from "react";
import { num } from "@/lib/format";
import { ROOF_TYPES, ROOFS, type RoofType } from "@/lib/house/roofs";
import { DIMENSION_LIMITS, SPACING_LIMITS, useHouseStore, type Dimension } from "@/lib/houseStore";
import { Segmented, Slider } from "./ui";

/** Siluety striech – remeselník spozná tvar rýchlejšie ako text. */
const ROOF_ICONS: Record<RoofType, ReactNode> = {
  flat: <path d="M4 14h32M6 14v12h28V14" />,
  gable: <path d="M3 16 20 5l17 11M7 14v12h26V14" />,
  aframe: <path d="M5 28 20 4l15 24zM16 28v-7h8v7" />,
};

const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "length", label: "Dĺžka domu" },
  { key: "width", label: "Šírka domu" },
  { key: "wallHeight", label: "Výška stien" },
];

/** Ovládanie parametrov domu – každá zmena sa hneď prejaví v 3D aj vo výpočte. */
export function HouseControls({ showFraming = true }: { showFraming?: boolean }) {
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
        {showFraming && (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
