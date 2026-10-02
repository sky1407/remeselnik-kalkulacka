import { FALLBACK_FUEL, fetchFuelPrices } from "@/lib/travel/fuel";

/** GET /api/fuel – aktuálne priemerné ceny benzínu 95 a nafty v SR; pri výpadku ŠÚ SR posledné známe. */
export async function GET() {
  try {
    return Response.json(await fetchFuelPrices(), { headers: { "Cache-Control": "public, s-maxage=21600" } });
  } catch (err) {
    console.error("fuel", err);
    return Response.json(FALLBACK_FUEL, { headers: { "Cache-Control": "public, s-maxage=600" } });
  }
}
