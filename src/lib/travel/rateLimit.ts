import "server-only";

const WINDOW_MS = 60_000;
/** Strop počtu sledovaných IP – ochrana pred rastom pamäte pri útoku z mnohých adries. */
const MAX_TRACKED = 5_000;

const hits = new Map<string, number[]>();

/**
 * Jednoduchý limit požiadaviek na IP v pamäti procesu (best effort). Chráni bezplatné
 * mapové služby pred zneužitím cez náš server – inak by mohli zablokovať celú aplikáciu.
 */
export function isRateLimited(request: Request, limit = 30): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= limit) return true;
  if (!hits.has(ip) && hits.size >= MAX_TRACKED) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}
