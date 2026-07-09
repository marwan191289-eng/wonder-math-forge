import { createFileRoute } from "@tanstack/react-router";
import { withCache } from "@/lib/binance/cache";
import { binanceGet } from "@/lib/binance/fetch";
import { withEdgeCache, rateLimit } from "@/lib/binance/edge-cache";
import { symbolSchema, limitSchema } from "@/lib/binance/validate";
import type { Depth } from "@/lib/binance/types";

interface RawDepth {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

export const Route = createFileRoute("/api/binance/depth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = rateLimit(request, "depth", { limit: 120, windowMs: 60_000 });
        if (limited) return limited;

        const url = new URL(request.url);
        const parsed = symbolSchema.safeParse(url.searchParams.get("symbol") ?? "BTCUSDT");
        if (!parsed.success) {
          return Response.json({ error: "invalid_symbol" }, { status: 400 });
        }
        const symbol = parsed.data;
        const limit = limitSchema(20, 1000, 500).parse(url.searchParams.get("limit") ?? 500);

        return withEdgeCache(request, { ttl: 2, tag: `${symbol}:${limit}` }, async () => {
          try {
            const key = `depth:${symbol}:${limit}`;
            const data = await withCache(key, 2_000, async () => {
              const raw = await binanceGet<RawDepth>("/api/v3/depth", { symbol, limit });
              const depth: Depth = {
                lastUpdateId: raw.lastUpdateId,
                bids: raw.bids.map(([p, q]) => ({ price: +p, qty: +q })),
                asks: raw.asks.map(([p, q]) => ({ price: +p, qty: +q })),
              };
              return depth;
            });
            return Response.json({ symbol, depth: data }, {
              headers: { "cache-control": "public, s-maxage=2, max-age=1" },
            });
          } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 502 });
          }
        });
      },
    },
  },
});
