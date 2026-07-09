// Binance combined WebSocket streams.
// Docs: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
// We use the market-data mirror wss://data-stream.binance.vision (same as REST mirror,
// no geo restrictions on Cloudflare/edge). Falls back to stream.binance.com.
import type { AggTrade, Depth } from "./types";

const WS_HOSTS = [
  "wss://data-stream.binance.vision/stream",
  "wss://stream.binance.com:9443/stream",
];

interface RawDepth {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}
interface RawAggTrade {
  a: number; p: string; q: string; T: number; m: boolean;
}
interface StreamMessage<T> { stream: string; data: T }

export interface BinanceStreamHandlers {
  onDepth?: (depth: Depth) => void;
  onTrade?: (trade: AggTrade) => void;
  onStatus?: (status: "connecting" | "open" | "closed") => void;
}

/**
 * Subscribe to combined depth20@100ms + aggTrade streams for a symbol.
 * Returns a disposer. Auto-reconnects with exponential backoff.
 */
export function openBinanceStream(symbol: string, handlers: BinanceStreamHandlers): () => void {
  const s = symbol.toLowerCase();
  const streams = `${s}@depth20@100ms/${s}@aggTrade`;
  let disposed = false;
  let ws: WebSocket | null = null;
  let hostIdx = 0;
  let backoff = 500;

  const connect = () => {
    if (disposed) return;
    handlers.onStatus?.("connecting");
    const host = WS_HOSTS[hostIdx % WS_HOSTS.length];
    try {
      ws = new WebSocket(`${host}?streams=${streams}`);
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      backoff = 500;
      handlers.onStatus?.("open");
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as StreamMessage<RawDepth | RawAggTrade>;
        if (msg.stream.endsWith("@aggTrade")) {
          const t = msg.data as RawAggTrade;
          handlers.onTrade?.({
            id: t.a, price: +t.p, qty: +t.q, time: t.T, isBuyerMaker: t.m,
          });
        } else if (msg.stream.includes("@depth")) {
          const d = msg.data as RawDepth;
          handlers.onDepth?.({
            lastUpdateId: d.lastUpdateId,
            bids: d.bids.map(([p, q]) => ({ price: +p, qty: +q })),
            asks: d.asks.map(([p, q]) => ({ price: +p, qty: +q })),
          });
        }
      } catch {
        // ignore malformed frame
      }
    };
    ws.onclose = () => {
      handlers.onStatus?.("closed");
      hostIdx += 1;
      scheduleReconnect();
    };
    ws.onerror = () => {
      try { ws?.close(); } catch { /* noop */ }
    };
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    const delay = Math.min(backoff, 15_000);
    backoff = Math.min(backoff * 2, 15_000);
    setTimeout(connect, delay);
  };

  connect();
  return () => {
    disposed = true;
    try { ws?.close(); } catch { /* noop */ }
  };
}
