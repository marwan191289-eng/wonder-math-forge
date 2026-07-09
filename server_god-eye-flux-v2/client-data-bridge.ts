/**
 * client-data-bridge.ts
 *
 * WHY THIS FILE EXISTS (found during Phase 2 integration audit):
 * The UI-base client (algorithmic-oracle) represents order-book depth as
 *   { price: number; qty: number }[]
 * while every server engine ported from god-eye-flux-v2 (vpin-advanced.ts,
 * order-flow-analysis.ts, liquidity-sweep.ts, etc.) destructures depth as
 * raw Binance tuples:
 *   [priceString, volumeString][]
 *
 * Feeding the client's object-shaped OrderBook directly into the server
 * engines would throw ("is not iterable") or, in looser spots, silently
 * yield NaN/0 — i.e. a numbers-look-plausible-but-are-wrong failure mode.
 * This bridge is the single, tested conversion point so no engine has to
 * guess the shape, and no naive undefined-defaulting can quietly produce
 * fake-looking-real numbers.
 */

import type { OrderBook as ClientOrderBook, Kline as ClientKline } from "../ui_base_algorithmic-oracle_src/lib/binance";

/** Raw tuple shape every ported server engine expects. */
export interface EngineOrderBook {
  bids: [string, string][];
  asks: [string, string][];
  lastUpdateId: number;
}

/** Raw string-close shape some server engines (ml-*-real.ts) expect. */
export interface EngineKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export function toEngineOrderBook(ob: ClientOrderBook): EngineOrderBook {
  return {
    lastUpdateId: ob.lastUpdateId,
    bids: ob.bids.map((l) => [String(l.price), String(l.qty)] as [string, string]),
    asks: ob.asks.map((l) => [String(l.price), String(l.qty)] as [string, string]),
  };
}

export function toEngineKline(k: ClientKline): EngineKline {
  return {
    openTime: k.openTime,
    open: String(k.open),
    high: String(k.high),
    low: String(k.low),
    close: String(k.close),
    volume: String(k.volume),
    closeTime: k.closeTime,
  };
}

export function toEngineKlines(klines: ClientKline[]): EngineKline[] {
  return klines.map(toEngineKline);
}

/**
 * Self-check: throws loudly if a shape mismatch slips back in.
 * Call this in dev / CI, not on every request (cheap but not free).
 */
export function assertEngineOrderBookShape(ob: unknown): asserts ob is EngineOrderBook {
  const o = ob as EngineOrderBook;
  if (!Array.isArray(o?.bids) || !Array.isArray(o?.asks)) {
    throw new Error("[client-data-bridge] OrderBook.bids/asks must be arrays");
  }
  if (o.bids.length > 0 && !Array.isArray(o.bids[0])) {
    throw new Error(
      "[client-data-bridge] OrderBook levels must be [price, volume] tuples, not {price, qty} objects. " +
        "Did you forget to call toEngineOrderBook()?"
    );
  }
}
