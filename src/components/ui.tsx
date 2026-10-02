"use client";

import type { ReactNode } from "react";

/** Spoločné ovládacie prvky s veľkými dotykovými plochami (ovládanie aj v rukaviciach). */

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
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

export function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
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

/** Rozbaľovacia sekcia s mriežkou polí – nastavenia sa nepletú pod rukami, kým ich netreba. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl bg-white ring-1 ring-stone-200 open:shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold">
        {title}
        <span className="text-stone-400 transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}
