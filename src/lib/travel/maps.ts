import { z } from "zod";

/**
 * Bezplatné mapové služby bez API kľúča:
 * - Photon (komoot) – vyhľadanie adresy nad dátami OpenStreetMap,
 * - OSRM – trasa autom po cestách.
 * Obe majú „fair use“ – preto volania idú cez náš server s cache a limitom požiadaviek.
 */
const PHOTON_URL = "https://photon.komoot.io/api/";
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving/";
export const USER_AGENT = "remeselnik-kalkulacka/0.1";
const TIMEOUT_MS = 8000;

/** Stredná Európa – remeselník zo SK jazdí aj do CZ, AT, HU, PL. */
export const PointSchema = z.object({
  lat: z.number().finite().min(45).max(52),
  lon: z.number().finite().min(12).max(25),
});
export type Point = z.infer<typeof PointSchema>;

export interface Place extends Point {
  label: string;
}

export interface RouteResult {
  km: number;
  minutes: number;
}

const PhotonSchema = z.object({
  features: z.array(
    z.object({
      geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
      properties: z
        .object({
          name: z.string(),
          street: z.string(),
          housenumber: z.string(),
          city: z.string(),
          postcode: z.string(),
          countrycode: z.string(),
        })
        .partial(),
    }),
  ),
});

/** Z odpovede Photonu poskladá čitateľné adresy; body mimo strednej Európy vyradí. */
export function parsePhoton(json: unknown): Place[] {
  const { features } = PhotonSchema.parse(json);
  const seen = new Set<string>();
  return features.flatMap(({ geometry, properties: p }) => {
    const [lon, lat] = geometry.coordinates;
    const street = [p.street, p.housenumber].filter(Boolean).join(" ");
    const parts = [p.name !== p.street ? p.name : undefined, street, [p.postcode, p.city].filter(Boolean).join(" ")];
    const label = parts.filter(Boolean).join(", ");
    if (!label || seen.has(label) || !PointSchema.safeParse({ lat, lon }).success) return [];
    seen.add(label);
    return [{ label, lat, lon }];
  });
}

const OsrmSchema = z.object({
  code: z.string(),
  routes: z.array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative() })).optional(),
});

/** @throws Error ak OSRM trasu nenašlo. */
export function parseOsrm(json: unknown): RouteResult {
  const data = OsrmSchema.parse(json);
  const route = data.routes?.[0];
  if (data.code !== "Ok" || !route) throw new Error(`Trasa sa nenašla (${data.code})`);
  return { km: Math.round(route.distance / 100) / 10, minutes: Math.round(route.duration / 60) };
}

async function getJson(url: string, revalidate: number): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${new URL(url).host} vrátil ${res.status}`);
  return res.json();
}

export async function geocode(query: string): Promise<Place[]> {
  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "default");
  // Uprednostní výsledky zo stredu Slovenska.
  url.searchParams.set("lat", "48.7");
  url.searchParams.set("lon", "19.5");
  return parsePhoton(await getJson(url.toString(), 60 * 60 * 24 * 7));
}

export async function drivingRoute(from: Point, to: Point): Promise<RouteResult> {
  const coords = `${from.lon.toFixed(5)},${from.lat.toFixed(5)};${to.lon.toFixed(5)},${to.lat.toFixed(5)}`;
  return parseOsrm(await getJson(`${OSRM_URL}${coords}?overview=false`, 60 * 60 * 24 * 30));
}
