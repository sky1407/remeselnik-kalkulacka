import { drivingRoute, PointSchema } from "@/lib/travel/maps";
import { isRateLimited } from "@/lib/travel/rateLimit";

/** „lat,lon“ → bod; neplatný vstup vráti `null`. */
function parsePoint(raw: string | null) {
  const [lat, lon] = (raw ?? "").split(",").map(Number);
  const point = PointSchema.safeParse({ lat, lon });
  return point.success ? point.data : null;
}

/** GET /api/route?from=lat,lon&to=lat,lon – vzdialenosť autom v km a čas v minútach. */
export async function GET(request: Request) {
  if (isRateLimited(request)) return Response.json({ error: "Príliš veľa požiadaviek, skús o minútu." }, { status: 429 });

  const params = new URL(request.url).searchParams;
  const from = parsePoint(params.get("from"));
  const to = parsePoint(params.get("to"));
  if (!from || !to) return Response.json({ error: "Neplatné súradnice." }, { status: 400 });

  try {
    return Response.json(await drivingRoute(from, to));
  } catch (err) {
    console.error("route", err);
    return Response.json({ error: "Trasu sa nepodarilo vypočítať. Zadaj km ručne." }, { status: 502 });
  }
}
