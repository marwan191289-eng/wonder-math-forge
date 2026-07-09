// Cloudflare Worker Cache API wrapper + tiny per-isolate rate limiter.
// - cacheApi(): edge-shared CDN cache keyed on the request URL. Falls back
//   silently when caches.default is unavailable (dev / non-CF runtime).
// - rateLimit(): per-isolate token bucket keyed on IP+route. Not distributed,
//   but stops the vast majority of abuse bursts hitting a single edge.

type Loader = () => Promise<Response>;

interface EdgeCacheOptions {
  /** Seconds. Sent via Cache-Control: public, s-maxage=... */
  ttl: number;
  /** Extra vary tag appended to the cache key. */
  tag?: string;
}

// Cloudflare Workers expose `caches.default`; other runtimes might not.
function getCache(): Cache | null {
  try {
    // @ts-expect-error - `caches.default` is a Cloudflare-specific extension.
    return typeof caches !== "undefined" && caches.default ? caches.default : null;
  } catch {
    return null;
  }
}

export async function withEdgeCache(
  request: Request,
  { ttl, tag }: EdgeCacheOptions,
  loader: Loader,
): Promise<Response> {
  const cache = getCache();
  const key = tag
    ? new Request(`${request.url}${request.url.includes("?") ? "&" : "?"}__t=${tag}`, request)
    : request;

  if (cache) {
    const hit = await cache.match(key);
    if (hit) return new Response(hit.body, hit);
  }

  const res = await loader();
  if (cache && res.ok) {
    const headers = new Headers(res.headers);
    if (!headers.has("cache-control")) {
      headers.set("cache-control", `public, s-maxage=${ttl}, max-age=1`);
    }
    const cached = new Response(res.clone().body, { status: res.status, headers });
    // Fire-and-forget: don't await, don't fail the request on cache put errors.
    void cache.put(key, cached).catch(() => {});
  }
  return res;
}

// -------- Rate limit --------
interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

export function rateLimit(
  request: Request,
  route: string,
  { limit = 60, windowMs = 60_000 } = {},
): Response | null {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "anon";
  const key = `${route}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  b.count += 1;
  if (b.count > limit) {
    const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return new Response(JSON.stringify({ error: "rate_limited", retry_after: retry }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retry),
        "cache-control": "no-store",
      },
    });
  }
  return null;
}
