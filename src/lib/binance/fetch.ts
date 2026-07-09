// Server-only Binance REST helper. Called from server routes so the browser
// never talks to Binance directly (avoids CORS + hides rate-limit surface).
//
// NOTE: api.binance.com blocks most Cloudflare Worker egress IPs with HTTP 403
// ("Request blocked"). The public market-data mirror `data-api.binance.vision`
// serves the same /api/v3/* market endpoints without geo/IP restrictions and
// is the recommended host for edge/serverless callers. We try the mirror
// first, then fall back through regional hosts before giving up.

const HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
];

// Allow-list keeps the proxy from being weaponized as a generic fetcher.
const SYMBOL_RE = /^[A-Z0-9]{5,20}$/;

export function assertSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  if (!SYMBOL_RE.test(s)) throw new Error(`Invalid symbol: ${symbol}`);
  return s;
}

export async function binanceGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const suffix = `${path}?${qs.toString()}`;

  let lastErr: unknown;
  for (const host of HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const res = await fetch(host + suffix, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (res.ok) return (await res.json()) as T;
      // 403/451 = host blocked us; try the next mirror. 4xx on payload = abort.
      if (res.status === 403 || res.status === 451 || res.status === 418 || res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Binance ${res.status} @ ${host}`);
        continue;
      }
      const body = await res.text().catch(() => "");
      throw new Error(`Binance ${res.status}: ${body.slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
      // network/timeout/blocked → try next host
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Binance unreachable: ${(lastErr as Error)?.message ?? "unknown"}`);
}
