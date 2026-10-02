"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { FALLBACK_FUEL, type FuelPrices } from "./fuel";

const FuelPricesSchema = z.object({
  petrol95: z.number().positive().max(5),
  diesel: z.number().positive().max(5),
  period: z.string().max(100),
  source: z.enum(["susr", "fallback"]),
});

/** Jedna požiadavka na celú reláciu – viac komponentov zdieľa ten istý Promise. */
let pending: Promise<FuelPrices> | null = null;

async function loadFuelPrices(): Promise<FuelPrices> {
  try {
    const res = await fetch("/api/fuel");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return FuelPricesSchema.parse(await res.json());
  } catch (err) {
    console.warn("Ceny palív nedostupné, používam posledné známe", err);
    return FALLBACK_FUEL;
  }
}

/** Aktuálne priemerné ceny palív v SR; kým sa nenačítajú, vráti `null`. */
export function useFuelPrices(): FuelPrices | null {
  const [prices, setPrices] = useState<FuelPrices | null>(null);

  useEffect(() => {
    let alive = true;
    (pending ??= loadFuelPrices()).then((p) => alive && setPrices(p));
    return () => {
      alive = false;
    };
  }, []);

  return prices;
}
