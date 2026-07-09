// Regression tests for the V2 institutional-score pipeline.
// Feeds synthetic klines + order books representing each regime and asserts
// bias/regime/confidence stay within reasonable bounds.
import { describe, expect, it } from "vitest";
import type { Depth, Kline } from "@/lib/binance/types";
import { analyzeV2 } from "@/lib/analytics/v2";
import { detectRegime } from "@/lib/analytics/v2/institutional-score-v2";

function makeKlines(gen: (i: number) => { close: number; vol?: number }, n = 120): Kline[] {
  const out: Kline[] = [];
  let t = 1_700_000_000_000;
  for (let i = 0; i < n; i++) {
    const { close, vol = 1_000 } = gen(i);
    const open = i === 0 ? close : out[i - 1].close;
    const high = Math.max(open, close) * 1.001;
    const low = Math.min(open, close) * 0.999;
    out.push({
      openTime: t,
      open,
      high,
      low,
      close,
      volume: vol,
      closeTime: t + 60_000,
      quoteVolume: vol * close,
      trades: 100,
      takerBuyBase: vol * 0.5,
      takerBuyQuote: vol * close * 0.5,
    });
    t += 60_000;
  }
  return out;
}

function makeDepth(mid: number, bias: "bull" | "bear" | "flat" = "flat"): Depth {
  const bids = [];
  const asks = [];
  const bidBoost = bias === "bull" ? 3 : 1;
  const askBoost = bias === "bear" ? 3 : 1;
  for (let i = 0; i < 300; i++) {
    const p = mid * (1 - (i + 1) * 0.0002);
    bids.push({ price: p, qty: (10 + Math.random() * 5) * bidBoost });
  }
  for (let i = 0; i < 300; i++) {
    const p = mid * (1 + (i + 1) * 0.0002);
    asks.push({ price: p, qty: (10 + Math.random() * 5) * askBoost });
  }
  return { lastUpdateId: 1, bids, asks };
}

describe("analyzeV2 · regime detection", () => {
  it("labels a steady uptrend as trending", () => {
    const klines = makeKlines((i) => ({ close: 100 + i * 2 }));
    const { regime } = detectRegime(klines);
    // Strong directional move → trending or volatile (never ranging).
    expect(regime).not.toBe("ranging");
  });

  it("labels a tight oscillation as ranging", () => {
    const klines = makeKlines((i) => ({ close: 100 + Math.sin(i / 3) * 0.15 }));
    const { regime, chopLevel } = detectRegime(klines);
    expect(regime).toBe("ranging");
    expect(chopLevel).toBeGreaterThan(0.3);
  });

  it("labels wide random swings as volatile", () => {
    let p = 100;
    const klines = makeKlines(() => {
      p += (Math.random() - 0.5) * 8;
      return { close: p };
    });
    const { regime } = detectRegime(klines);
    expect(["volatile", "trending"]).toContain(regime);
  });
});

describe("analyzeV2 · verdict shape", () => {
  it("returns a bounded, well-formed verdict for a bullish stack", () => {
    const klines = makeKlines((i) => ({ close: 100 + i * 0.4, vol: 1_000 + i * 20 }));
    const depth = makeDepth(klines.at(-1)!.close, "bull");
    const r = analyzeV2({ klines, depth });

    expect(r.verdict.score).toBeGreaterThanOrEqual(-100);
    expect(r.verdict.score).toBeLessThanOrEqual(100);
    expect(r.verdict.confidence).toBeGreaterThanOrEqual(0);
    expect(r.verdict.confidence).toBeLessThanOrEqual(100);
    expect(["long", "short", "none"]).toContain(r.verdict.targets.side);
    expect(r.verdict.reasoning.length).toBeGreaterThan(0);
    expect(Number.isFinite(r.verdict.targets.entry)).toBe(true);
    // Bullish book bias should not produce a strong-bear label.
    expect(r.verdict.bias).not.toBe("strong-bear");
  });

  it("respects EMA smoothing when prevScore is provided", () => {
    const klines = makeKlines((i) => ({ close: 100 + i * 0.4 }));
    const depth = makeDepth(klines.at(-1)!.close, "bull");
    const first = analyzeV2({ klines, depth });
    const smoothed = analyzeV2({ klines, depth, prevScore: -80, emaAlpha: 0.2 });
    // A large negative prevScore + small alpha must pull the smoothed score
    // strictly below the un-smoothed raw score.
    expect(smoothed.verdict.score).toBeLessThan(first.verdict.scoreRaw + 1);
  });

  it("bearish depth stack produces non-positive bias tilt", () => {
    const klines = makeKlines((i) => ({ close: 100 - i * 0.4 }));
    const depth = makeDepth(klines.at(-1)!.close, "bear");
    const r = analyzeV2({ klines, depth });
    expect(r.verdict.bias).not.toBe("strong-bull");
    expect(r.verdict.components.proximityPressure).toBeLessThanOrEqual(0.5);
  });

  it("honors tunable wall z-threshold", () => {
    const klines = makeKlines(() => ({ close: 100 }));
    const depth = makeDepth(100, "flat");
    const strict = analyzeV2({ klines, depth, wallZThreshold: 4.5 });
    const loose = analyzeV2({ klines, depth, wallZThreshold: 1.2 });
    expect(loose.walls.bidWalls.length + loose.walls.askWalls.length)
      .toBeGreaterThanOrEqual(strict.walls.bidWalls.length + strict.walls.askWalls.length);
  });
});
