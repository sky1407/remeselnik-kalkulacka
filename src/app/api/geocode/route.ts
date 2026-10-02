import { z } from "zod";
import { geocode } from "@/lib/travel/maps";
import { isRateLimited } from "@/lib/travel/rateLimit";

const QuerySchema = z.string().trim().min(3).max(120);

/** GET /api/geocode?q=… – návrhy adries pre našepkávač. */
export async function GET(request: Request) {
  if (isRateLimited(request)) return Response.json({ error: "Príliš veľa požiadaviek, skús o minútu." }, { status: 429 });

  const q = QuerySchema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!q.success) return Response.json({ error: "Zadaj aspoň 3 znaky adresy." }, { status: 400 });

  try {
    return Response.json({ places: await geocode(q.data) });
  } catch (err) {
    console.error("geocode", err);
    return Response.json({ error: "Vyhľadávanie adries je dočasne nedostupné." }, { status: 502 });
  }
}
