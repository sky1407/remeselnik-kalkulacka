"use client";

import { useEffect, useId, useState } from "react";
import type { Place } from "@/lib/travel/maps";

const DEBOUNCE_MS = 400;
const MIN_CHARS = 3;

interface AddressSearchProps {
  label: string;
  value: Place | null;
  onSelect: (place: Place | null) => void;
}

type SearchState = { status: "idle" | "loading" } | { status: "done"; places: Place[] } | { status: "error"; message: string };

/** Našepkávač adries – píše sa ako do Google Máp, ťuknutím sa vyberie. */
export function AddressSearch({ label, value, onSelect }: AddressSearchProps) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_CHARS) return;
    const controller = new AbortController();
    // Čaká, kým remeselník dopíše – šetrí bezplatnú službu aj dáta v mobile.
    const timer = setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const body: { places?: Place[]; error?: string } = await res.json();
        if (!res.ok || !body.places) throw new Error(body.error ?? "Vyhľadávanie zlyhalo");
        setState({ status: "done", places: body.places });
      } catch (err) {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "Vyhľadávanie zlyhalo" });
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (value) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm text-stone-600">{label}</span>
        <div className="flex min-h-12 items-center justify-between gap-2 rounded-lg border border-green-600 bg-green-50 px-3 py-2">
          <span className="text-sm font-medium text-stone-900">{value.label}</span>
          <button type="button" onClick={() => onSelect(null)} className="min-h-10 shrink-0 px-2 text-sm font-semibold text-green-800">
            Zmeniť
          </button>
        </div>
      </div>
    );
  }

  const places = state.status === "done" && trimmed.length >= MIN_CHARS ? state.places : [];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm text-stone-600">
        {label}
      </label>
      <input
        id={id}
        type="search"
        autoComplete="street-address"
        placeholder="Ulica, obec…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-12 rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900"
      />
      {state.status === "loading" && <p className="text-xs text-stone-500">Hľadám…</p>}
      {state.status === "error" && <p className="text-xs text-red-600">{state.message}</p>}
      {state.status === "done" && places.length === 0 && trimmed.length >= MIN_CHARS && (
        <p className="text-xs text-stone-500">Nič som nenašiel, skús pridať obec.</p>
      )}
      {places.length > 0 && (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {places.map((p) => (
            <li key={p.label}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setQuery("");
                  setState({ status: "idle" });
                }}
                className="min-h-12 w-full px-3 py-2 text-left text-sm text-stone-800 active:bg-green-50"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
