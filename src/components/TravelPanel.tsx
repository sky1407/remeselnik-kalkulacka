"use client";

import { useState } from "react";
import { eur, num } from "@/lib/format";
import { useSettingsStore } from "@/lib/settings";
import { effectiveFuelPrice, type FuelType } from "@/lib/travel/fuel";
import type { Place } from "@/lib/travel/maps";
import { useFuelPrices } from "@/lib/travel/useFuelPrices";
import { AddressSearch } from "./AddressSearch";
import { NumberField } from "./NumberField";

const FUEL_LABELS: Record<FuelType, string> = { diesel: "Nafta", petrol95: "Benzín 95" };

type RouteState = { status: "idle" } | { status: "loading" } | { status: "ok"; minutes: number } | { status: "error"; message: string };

/** Cestovné: trasa medzi dielňou a zákazkou, amortizácia auta a palivo za aktuálnu cenu. */
export function TravelPanel() {
  const travel = useSettingsStore((s) => s.travel);
  const setTravel = useSettingsStore((s) => s.setTravel);
  const prices = useFuelPrices();
  const [route, setRoute] = useState<RouteState>({ status: "idle" });

  /** Trasa sa počíta len po výbere adresy – ručne zadané km sa nikdy samy neprepíšu. */
  async function computeRoute(from: Place | null, to: Place | null) {
    if (!from || !to) return;
    setRoute({ status: "loading" });
    try {
      const res = await fetch(`/api/route?from=${from.lat},${from.lon}&to=${to.lat},${to.lon}`);
      const body: { km?: number; minutes?: number; error?: string } = await res.json();
      if (!res.ok || body.km === undefined || body.minutes === undefined) throw new Error(body.error ?? "Trasa zlyhala");
      setTravel({ distanceKmOneWay: body.km });
      setRoute({ status: "ok", minutes: body.minutes });
    } catch (err) {
      setRoute({ status: "error", message: err instanceof Error ? err.message : "Trasa zlyhala" });
    }
  }

  const market = prices?.[travel.fuelType];
  const fuelPrice = effectiveFuelPrice(travel.fuelPriceOverride, travel.fuelType, prices);

  return (
    <details className="group rounded-xl bg-white ring-1 ring-stone-200 open:shadow-sm">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-semibold">
        <span>
          Doprava
          {travel.distanceKmOneWay > 0 && (
            <span className="ml-2 font-normal text-stone-500">{num.format(travel.distanceKmOneWay)} km</span>
          )}
        </span>
        <span className="text-stone-400 transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>

      <div className="flex flex-col gap-3 px-4 pb-4">
        <AddressSearch
          label="Odkiaľ (dielňa)"
          value={travel.origin}
          onSelect={(origin) => {
            setTravel({ origin });
            void computeRoute(origin, travel.destination);
          }}
        />
        <AddressSearch
          label="Kam (zákazka)"
          value={travel.destination}
          onSelect={(destination) => {
            setTravel({ destination });
            void computeRoute(travel.origin, destination);
          }}
        />
        {route.status === "loading" && <p className="text-xs text-stone-500">Počítam trasu…</p>}
        {route.status === "ok" && <p className="text-xs text-green-700">Trasa autom: cca {route.minutes} min jedným smerom</p>}
        {route.status === "error" && <p className="text-xs text-red-600">{route.message}</p>}

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Vzdialenosť jedným smerom"
            value={travel.distanceKmOneWay}
            min={0}
            max={1000}
            unit="km"
            hint="dá sa prepísať"
            onCommit={(distanceKmOneWay) => setTravel({ distanceKmOneWay })}
          />
          <NumberField
            label="Počet ciest"
            value={travel.trips}
            min={1}
            max={100}
            unit="×"
            hint="tam aj späť"
            onCommit={(trips) => Number.isInteger(trips) && setTravel({ trips })}
          />
          <NumberField
            label="Spotreba auta"
            value={travel.consumptionL100}
            min={0}
            max={40}
            unit="l/100 km"
            onCommit={(consumptionL100) => setTravel({ consumptionL100 })}
          />
          <NumberField
            label="Náhrada za km"
            value={travel.ratePerKm}
            min={0}
            max={5}
            unit="€/km"
            hint="od 2026: 0,313 €"
            onCommit={(ratePerKm) => setTravel({ ratePerKm })}
          />
        </div>

        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1.5 text-sm text-stone-600">Palivo</legend>
          {(Object.keys(FUEL_LABELS) as FuelType[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={travel.fuelType === t}
              onClick={() => setTravel({ fuelType: t })}
              className={`min-h-12 rounded-xl border-2 text-sm font-semibold ${
                travel.fuelType === t ? "border-green-600 bg-green-50 text-green-800" : "border-stone-200 bg-white text-stone-700"
              }`}
            >
              {FUEL_LABELS[t]}
            </button>
          ))}
        </fieldset>

        <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={travel.fuelPriceOverride !== null}
            onChange={(e) => setTravel({ fuelPriceOverride: e.target.checked ? fuelPrice : null })}
            className="h-6 w-6 accent-green-600"
          />
          Vlastná cena paliva
        </label>
        {travel.fuelPriceOverride !== null ? (
          <NumberField
            label={`Cena – ${FUEL_LABELS[travel.fuelType]}`}
            value={travel.fuelPriceOverride}
            min={0.5}
            max={5}
            unit="€/l"
            onCommit={(fuelPriceOverride) => setTravel({ fuelPriceOverride })}
          />
        ) : (
          <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
            {market === undefined ? (
              "Načítavam aktuálnu cenu…"
            ) : (
              <>
                Priemer SR: <b>{eur.format(market)}/l</b>
                <span className="block text-xs text-stone-500">
                  {prices?.source === "susr" ? "Štatistický úrad SR" : "posledná známa cena (ŠÚ SR je nedostupný)"},{" "}
                  {prices?.period}
                </span>
              </>
            )}
          </p>
        )}
      </div>
    </details>
  );
}
