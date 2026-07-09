import { queryOptions } from "@tanstack/react-query";
import type { Depth, Kline, AggTrade, Ticker24h } from "@/lib/binance/types";

async function jget<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

export const klinesQuery = (symbol: string, interval: string, limit = 200) =>
  queryOptions({
    queryKey: ["klines", symbol, interval, limit],
    queryFn: () =>
      jget<{ klines: Kline[] }>(
        `/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      ).then((d) => d.klines),
    refetchInterval: 5_000,
    staleTime: 4_000,
  });

// Depth/trades: low-frequency REST as a fallback. WebSocket combined streams
// (see hooks/use-binance-stream.ts) push live updates into the cache; polling
// only fills the gap when the socket is reconnecting.
export const depthQuery = (symbol: string, limit = 500) =>
  queryOptions({
    queryKey: ["depth", symbol, limit],
    queryFn: () =>
      jget<{ depth: Depth }>(`/api/binance/depth?symbol=${symbol}&limit=${limit}`).then(
        (d) => d.depth,
      ),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

export const tradesQuery = (symbol: string, limit = 500) =>
  queryOptions({
    queryKey: ["trades", symbol, limit],
    queryFn: () =>
      jget<{ trades: AggTrade[] }>(
        `/api/binance/trades?symbol=${symbol}&limit=${limit}`,
      ).then((d) => d.trades),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

export const tickerQuery = (symbols: string[]) =>
  queryOptions({
    queryKey: ["ticker", symbols.join(",")],
    queryFn: () =>
      jget<{ tickers: Ticker24h[] }>(
        `/api/binance/ticker?symbols=${symbols.join(",")}`,
      ).then((d) => d.tickers),
    refetchInterval: 5_000,
    staleTime: 4_500,
  });
