// Real Binance-backed rolling candle buffer.
// - Fetches an initial window of `size` klines via the same /api/binance/klines proxy.
// - Opens a Binance kline WebSocket stream and updates the live (last) candle every tick.
// - On candle close, shifts the oldest candle and appends the new one — buffer size stays
//   strictly bounded at `size` so browser memory is capped.
//
// All four downstream engines (Elliott / CVD / SMC / LSTM on /oracle, and the quant
// modules on /quant) receive the SAME array reference view, so every engine sees the
// same number of candles on the same timeframe — but each engine is invoked
// independently (no cross-engine mutation of state).
import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/engines/types";

const WS_HOSTS = [
  "wss://data-stream.binance.vision/stream",
  "wss://stream.binance.com:9443/stream",
];

interface KlinesResp {
  klines: Array<{
    openTime: number; open: number; high: number; low: number; close: number;
    volume: number; takerBuyBase: number;
  }>;
}

interface RawKlineMsg {
  e: "kline";
  s: string;
  k: {
    t: number; T: number; s: string; i: string;
    o: string; c: string; h: string; l: string; v: string;
    x: boolean; // is candle closed
    V: string;  // taker buy base asset volume
  };
}

interface StreamEnvelope<T> { stream: string; data: T }

export type StreamStatus = "idle" | "connecting" | "open" | "closed";

export interface RollingCandlesState {
  candles: Candle[];
  status: StreamStatus;
  lastTickAt: number | null;
  error: string | null;
}

async function fetchInitial(symbol: string, interval: string, size: number): Promise<Candle[]> {
  const r = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=${size}`);
  if (!r.ok) throw new Error(`klines ${r.status}`);
  const j = (await r.json()) as KlinesResp;
  return j.klines.map((k) => ({
    time: k.openTime,
    open: k.open, high: k.high, low: k.low, close: k.close,
    volume: k.volume,
    takerBuyVolume: k.takerBuyBase,
  }));
}

/**
 * Rolling candle buffer of exactly `size` candles for one (symbol, interval) pair.
 * The buffer NEVER exceeds `size` — the oldest candle is dropped as each new one
 * closes, keeping memory constant.
 */
export function useRollingCandles(
  symbol: string,
  interval: string,
  size: number = 300,
): RollingCandlesState {
  const [state, setState] = useState<RollingCandlesState>({
    candles: [],
    status: "idle",
    lastTickAt: null,
    error: null,
  });

  // Keep a ref so WS handler mutates the same buffer without re-triggering effects.
  const bufRef = useRef<Candle[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;
    let hostIdx = 0;
    let backoff = 500;

    const scheduleFlush = () => {
      if (flushTimerRef.current != null) return;
      flushTimerRef.current = window.setTimeout(() => {
        flushTimerRef.current = null;
        // Copy-on-flush: React sees a new reference, but only every ~200ms so we
        // do not thrash re-renders on every tick.
        setState((s) => ({ ...s, candles: bufRef.current.slice(), lastTickAt: Date.now() }));
      }, 200);
    };

    const applyLiveTick = (msg: RawKlineMsg) => {
      const k = msg.k;
      const live: Candle = {
        time: k.t,
        open: +k.o, high: +k.h, low: +k.l, close: +k.c,
        volume: +k.v,
        takerBuyVolume: +k.V,
      };
      const buf = bufRef.current;
      const last = buf[buf.length - 1];
      if (!last) {
        buf.push(live);
      } else if (last.time === live.time) {
        // Update in place — same candle still forming.
        buf[buf.length - 1] = live;
      } else if (live.time > last.time) {
        // New candle. Push, then shift to keep the window fixed.
        buf.push(live);
        while (buf.length > size) buf.shift();
      }
      scheduleFlush();
    };

    const connect = () => {
      if (disposed) return;
      setState((s) => ({ ...s, status: "connecting" }));
      const host = WS_HOSTS[hostIdx % WS_HOSTS.length];
      const stream = `${symbol.toLowerCase()}@kline_${interval}`;
      try {
        ws = new WebSocket(`${host}?streams=${stream}`);
      } catch (e) {
        setState((s) => ({ ...s, status: "closed", error: String((e as Error).message) }));
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        backoff = 500;
        setState((s) => ({ ...s, status: "open", error: null }));
      };
      ws.onmessage = (ev) => {
        try {
          const env = JSON.parse(ev.data as string) as StreamEnvelope<RawKlineMsg>;
          if (env?.data?.e === "kline") applyLiveTick(env.data);
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        setState((s) => ({ ...s, status: "closed" }));
        hostIdx += 1;
        scheduleReconnect();
      };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      const delay = Math.min(backoff, 15_000);
      backoff = Math.min(backoff * 2, 15_000);
      setTimeout(connect, delay);
    };

    // Seed the buffer, then start streaming.
    (async () => {
      try {
        const initial = await fetchInitial(symbol, interval, size);
        if (disposed) return;
        bufRef.current = initial.slice(-size);
        setState({
          candles: bufRef.current.slice(),
          status: "connecting",
          lastTickAt: Date.now(),
          error: null,
        });
        connect();
      } catch (e) {
        if (!disposed) {
          setState((s) => ({ ...s, status: "closed", error: String((e as Error).message) }));
        }
      }
    })();

    return () => {
      disposed = true;
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      try { ws?.close(); } catch { /* noop */ }
      bufRef.current = [];
    };
  }, [symbol, interval, size]);

  return state;
}
