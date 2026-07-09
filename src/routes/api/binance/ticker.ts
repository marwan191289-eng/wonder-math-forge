import { createFileRoute } from "@tanstack/react-router";
import { withCache } from "@/lib/binance/cache";
import { binanceGet } from "@/lib/binance/fetch";
import { withEdgeCache, rateLimit } from "@/lib/binance/edge-cache";
import { symbolsListSchema } from "@/lib/binance/validate";
import type { Ticker24h } from "@/lib/binance/types";

interface RawTicker {
  symbol: string; lastPrice: string; priceChangePercent: string;
  quoteVolume: string; highPrice: string; lowPrice: string;
}

export const Route = createFileRoute("/api/binance/ticker")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const limited = rateLimit(request, "ticker", { limit: 60, windowMs: 60_000 });
        if (limited) return limited;

        const url = new URL(request.url);
        const parsed = symbolsListSchema.safeParse(
          url.searchParams.get("symbols") ?? "BTCUSDT,ETHUSDT,SOLUSDT",
        );
        if (!parsed.success) {
          return Response.json({ error: "invalid_symbols" }, { status: 400 });
        }
        const symbols = parsed.data;

        return withEdgeCache(request, { ttl: 5, tag: symbols.join(",") }, async () => {
          try {
            const key = `ticker:${symbols.join(",")}`;
            const data = await withCache(key, 5_000, async () => {
              const raw = await binanceGet<RawTicker[]>(
                "/api/v3/ticker/24hr",
                { symbols: JSON.stringify(symbols) },
              );
              const tickers: Ticker24h[] = raw.map((r) => ({
                symbol: r.symbol,
                lastPrice: +r.lastPrice,
                priceChangePercent: +r.priceChangePercent,
                quoteVolume: +r.quoteVolume,
                highPrice: +r.highPrice,
                lowPrice: +r.lowPrice,
              }));
              return tickers;
            });
            return Response.json({ tickers: data }, {
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
