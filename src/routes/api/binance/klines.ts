import { createFileRoute } from "@tanstack/react-router";
import { withCache } from "@/lib/binance/cache";
import { binanceGet } from "@/lib/binance/fetch";
import { withEdgeCache, rateLimit } from "@/lib/binance/edge-cache";
import { symbolSchema, intervalSchema, limitSchema } from "@/lib/binance/validate";
import type { Kline } from "@/lib/binance/types";

type RawKline = [number, string, string, string, string, string, number, string, number, string, string, string];

export const Route = createFileRoute("/api/binance/klines")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = rateLimit(request, "klines", { limit: 120, windowMs: 60_000 });
        if (limited) return limited;

        const url = new URL(request.url);
        const symParsed = symbolSchema.safeParse(url.searchParams.get("symbol") ?? "BTCUSDT");
        const intParsed = intervalSchema.safeParse(url.searchParams.get("interval") ?? "1m");
        if (!symParsed.success || !intParsed.success) {
          return Response.json({ error: "invalid_params" }, { status: 400 });
        }
        const symbol = symParsed.data;
        const interval = intParsed.data;
        const limit = limitSchema(10, 1000, 200).parse(url.searchParams.get("limit") ?? 200);

        return withEdgeCache(request, { ttl: 5, tag: `${symbol}:${interval}:${limit}` }, async () => {
          try {
            const key = `klines:${symbol}:${interval}:${limit}`;
            const data = await withCache(key, 5_000, async () => {
              const raw = await binanceGet<RawKline[]>("/api/v3/klines", { symbol, interval, limit });
              const parsed: Kline[] = raw.map((r) => ({
                openTime: r[0],
                open: +r[1], high: +r[2], low: +r[3], close: +r[4],
                volume: +r[5],
                closeTime: r[6],
                quoteVolume: +r[7],
                trades: r[8],
                takerBuyBase: +r[9],
                takerBuyQuote: +r[10],
              }));
              return parsed;
            });
            return Response.json({ symbol, interval, klines: data }, {
              headers: { "cache-control": "public, s-maxage=5, max-age=3" },
            });
          } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 502 });
          }
        });
      },
    },
  },
});
