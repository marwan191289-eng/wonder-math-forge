import { createFileRoute } from "@tanstack/react-router";
import { withCache } from "@/lib/binance/cache";
import { binanceGet } from "@/lib/binance/fetch";
import { withEdgeCache, rateLimit } from "@/lib/binance/edge-cache";
import { symbolSchema, limitSchema } from "@/lib/binance/validate";
import type { AggTrade } from "@/lib/binance/types";

interface RawTrade {
  a: number; p: string; q: string; T: number; m: boolean;
}

export const Route = createFileRoute("/api/binance/trades")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = rateLimit(request, "trades", { limit: 120, windowMs: 60_000 });
        if (limited) return limited;

        const url = new URL(request.url);
        const parsed = symbolSchema.safeParse(url.searchParams.get("symbol") ?? "BTCUSDT");
        if (!parsed.success) {
          return Response.json({ error: "invalid_symbol" }, { status: 400 });
        }
        const symbol = parsed.data;
        const limit = limitSchema(50, 1000, 500).parse(url.searchParams.get("limit") ?? 500);

        return withEdgeCache(request, { ttl: 2, tag: `${symbol}:${limit}` }, async () => {
          try {
            const key = `trades:${symbol}:${limit}`;
            const data = await withCache(key, 2_000, async () => {
              const raw = await binanceGet<RawTrade[]>("/api/v3/aggTrades", { symbol, limit });
              const trades: AggTrade[] = raw.map((t) => ({
                id: t.a, price: +t.p, qty: +t.q, time: t.T, isBuyerMaker: t.m,
              }));
              return trades;
            });
            return Response.json({ symbol, trades: data }, {
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
