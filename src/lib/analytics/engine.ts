import type { Kline, AggTrade, Depth } from "@/lib/binance/types";

// -------- CVD (Cumulative Volume Delta) & Stealth Buying/Selling Index --------
export interface CVDPoint {
  time: number;
  cvd: number;
  price: number;
}

export function computeCVDFromTrades(trades: AggTrade[]): CVDPoint[] {
  let cvd = 0;
  return trades.map((t) => {
    // isBuyerMaker=true => aggressive sell; false => aggressive buy
    cvd += (t.isBuyerMaker ? -1 : 1) * t.qty;
    return { time: t.time, cvd, price: t.price };
  });
}

// SBI/SSI: divergence between price change and CVD change over a window.
// Stealth buying = price flat/down while CVD rising (accumulation).
export function stealthIndices(points: CVDPoint[], window = 30) {
  if (points.length < window + 1) return { sbi: 0, ssi: 0 };
  const a = points[points.length - window - 1];
  const b = points[points.length - 1];
  const dPrice = (b.price - a.price) / a.price;
  const dCVDNorm = (b.cvd - a.cvd) / Math.max(1, Math.abs(a.cvd) + Math.abs(b.cvd));
  // Stealth Buying: cvd up, price not up much
  const sbi = clamp(100 * (dCVDNorm - Math.max(0, dPrice) * 2), -100, 100);
  const ssi = clamp(100 * (-dCVDNorm - Math.max(0, -dPrice) * 2), -100, 100);
  return { sbi, ssi };
}

// -------- OFI (Order Flow Imbalance) --------
export interface OFIBucket {
  bucketTime: number;
  buy: number;
  sell: number;
  imbalance: number; // (buy - sell) / (buy + sell)
}

export function bucketOFI(trades: AggTrade[], bucketMs = 5_000, buckets = 30): OFIBucket[] {
  if (!trades.length) return [];
  const end = trades[trades.length - 1].time;
  const start = end - bucketMs * buckets;
  const map = new Map<number, { buy: number; sell: number }>();
  for (const t of trades) {
    if (t.time < start) continue;
    const k = Math.floor(t.time / bucketMs) * bucketMs;
    const cur = map.get(k) ?? { buy: 0, sell: 0 };
    if (t.isBuyerMaker) cur.sell += t.qty;
    else cur.buy += t.qty;
    map.set(k, cur);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([bucketTime, v]) => ({
      bucketTime,
      buy: v.buy,
      sell: v.sell,
      imbalance: (v.buy - v.sell) / Math.max(1e-9, v.buy + v.sell),
    }));
}

// -------- Whale Walls --------
export interface Wall {
  side: "bid" | "ask";
  price: number;
  qty: number;
  distancePct: number;
}

export function detectWalls(depth: Depth, mid: number, minQty: number): Wall[] {
  const bids: Wall[] = depth.bids
    .filter((l) => l.qty >= minQty)
    .map((l) => ({ side: "bid", price: l.price, qty: l.qty, distancePct: ((mid - l.price) / mid) * 100 }));
  const asks: Wall[] = depth.asks
    .filter((l) => l.qty >= minQty)
    .map((l) => ({ side: "ask", price: l.price, qty: l.qty, distancePct: ((l.price - mid) / mid) * 100 }));
  return [...bids, ...asks].sort((a, b) => b.qty - a.qty).slice(0, 12);
}

// -------- SMC: Order blocks, FVGs, BOS --------
export interface OrderBlock {
  type: "bull" | "bear";
  high: number;
  low: number;
  time: number;
}
export interface FVG {
  type: "bull" | "bear";
  top: number;
  bottom: number;
  time: number;
}
export interface BOS {
  type: "bull" | "bear";
  price: number;
  time: number;
}

export function detectSMC(klines: Kline[]) {
  const orderBlocks: OrderBlock[] = [];
  const fvgs: FVG[] = [];
  const bos: BOS[] = [];

  for (let i = 2; i < klines.length; i++) {
    const a = klines[i - 2];
    const b = klines[i - 1];
    const c = klines[i];

    // FVG: gap between candle a and c
    if (a.high < c.low) fvgs.push({ type: "bull", top: c.low, bottom: a.high, time: b.openTime });
    if (a.low > c.high) fvgs.push({ type: "bear", top: a.low, bottom: c.high, time: b.openTime });

    // Order block: last opposite candle before a strong impulse
    const impulseUp = c.close > c.open && (c.close - c.open) > (a.high - a.low) * 1.5;
    const impulseDn = c.close < c.open && (c.open - c.close) > (a.high - a.low) * 1.5;
    if (impulseUp && b.close < b.open)
      orderBlocks.push({ type: "bull", high: b.high, low: b.low, time: b.openTime });
    if (impulseDn && b.close > b.open)
      orderBlocks.push({ type: "bear", high: b.high, low: b.low, time: b.openTime });
  }

  // BOS: latest close breaking prior swing high/low
  const window = 20;
  if (klines.length > window + 1) {
    const recent = klines.slice(-window - 1, -1);
    const last = klines[klines.length - 1];
    const swingHigh = Math.max(...recent.map((k) => k.high));
    const swingLow = Math.min(...recent.map((k) => k.low));
    if (last.close > swingHigh) bos.push({ type: "bull", price: swingHigh, time: last.openTime });
    if (last.close < swingLow) bos.push({ type: "bear", price: swingLow, time: last.openTime });
  }

  return {
    orderBlocks: orderBlocks.slice(-6),
    fvgs: fvgs.slice(-6),
    bos: bos.slice(-3),
  };
}

// -------- VWAP + Liquidity Zones --------
export function computeVWAP(klines: Kline[]): number {
  let pv = 0;
  let vol = 0;
  for (const k of klines) {
    const typical = (k.high + k.low + k.close) / 3;
    pv += typical * k.volume;
    vol += k.volume;
  }
  return vol === 0 ? 0 : pv / vol;
}

export interface LiquidityZone {
  price: number;
  strength: number; // 0..1
  type: "support" | "resistance";
}

export function detectLiquidityZones(depth: Depth, mid: number, maxZones = 8): LiquidityZone[] {
  const bucket = mid * 0.0015; // 0.15% wide buckets
  const map = new Map<number, number>();
  for (const l of depth.bids) {
    const k = Math.floor(l.price / bucket) * bucket;
    map.set(k, (map.get(k) ?? 0) + l.qty);
  }
  for (const l of depth.asks) {
    const k = Math.floor(l.price / bucket) * bucket;
    map.set(k, (map.get(k) ?? 0) + l.qty);
  }
  const rows = [...map.entries()].map(([price, qty]) => ({ price, qty }));
  const max = Math.max(...rows.map((r) => r.qty), 1);
  return rows
    .sort((a, b) => b.qty - a.qty)
    .slice(0, maxZones)
    .map((r) => ({
      price: r.price,
      strength: r.qty / max,
      type: (r.price < mid ? "support" : "resistance") as "support" | "resistance",
    }))
    .sort((a, b) => a.price - b.price);
}

// -------- Institutional Score (8 components, weighted, [-100, 100]) --------
export interface ScoreComponent {
  key: string;
  label: string;
  value: number; // [-100, 100]
  weight: number;
}

export function institutionalScore(input: {
  klines: Kline[];
  trades: AggTrade[];
  depth: Depth;
  mid: number;
}) {
  const { klines, trades, depth, mid } = input;
  const cvd = computeCVDFromTrades(trades);
  const { sbi, ssi } = stealthIndices(cvd);
  const ofi = bucketOFI(trades);
  const walls = detectWalls(depth, mid, whaleThresholdFor(mid));
  const vwap = computeVWAP(klines);
  const { bos } = detectSMC(klines);

  // Component signals in [-100, 100]
  const cvdSlope = clamp(cvdSlopePct(cvd) * 500, -100, 100);
  const ofiAvg = clamp(avg(ofi.map((b) => b.imbalance)) * 100, -100, 100);
  const bidAskImb = clamp(bidAskImbalance(depth) * 100, -100, 100);
  const wallSkew = clamp(wallSideSkew(walls) * 100, -100, 100);
  const vwapDist = clamp(((mid - vwap) / vwap) * 2000, -100, 100);
  const bosSig = bos.length ? (bos[bos.length - 1].type === "bull" ? 60 : -60) : 0;
  const stealth = clamp(sbi - ssi, -100, 100);
  const trend = clamp(shortTrend(klines) * 400, -100, 100);

  const comps: ScoreComponent[] = [
    { key: "cvd", label: "CVD slope", value: cvdSlope, weight: 0.18 },
    { key: "ofi", label: "OFI (5s)", value: ofiAvg, weight: 0.16 },
    { key: "book", label: "Bid/Ask imbalance", value: bidAskImb, weight: 0.14 },
    { key: "walls", label: "Whale walls", value: wallSkew, weight: 0.10 },
    { key: "vwap", label: "VWAP distance", value: vwapDist, weight: 0.10 },
    { key: "bos", label: "Break of structure", value: bosSig, weight: 0.10 },
    { key: "stealth", label: "Stealth (SBI-SSI)", value: stealth, weight: 0.12 },
    { key: "trend", label: "Micro trend", value: trend, weight: 0.10 },
  ];
  const score = clamp(
    comps.reduce((s, c) => s + c.value * c.weight, 0),
    -100,
    100,
  );
  return { score, comps, vwap, sbi, ssi };
}

// ---- helpers ----
export function whaleThresholdFor(mid: number): number {
  // heuristic scale: ~$500K notional
  return Math.max(0.5, 500_000 / Math.max(mid, 1));
}
function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}
function avg(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function cvdSlopePct(cvd: CVDPoint[]) {
  if (cvd.length < 20) return 0;
  const a = cvd[cvd.length - 20];
  const b = cvd[cvd.length - 1];
  const denom = Math.max(1, Math.abs(a.cvd) + Math.abs(b.cvd));
  return (b.cvd - a.cvd) / denom;
}
function bidAskImbalance(depth: Depth) {
  const bid = depth.bids.slice(0, 20).reduce((s, l) => s + l.qty, 0);
  const ask = depth.asks.slice(0, 20).reduce((s, l) => s + l.qty, 0);
  return (bid - ask) / Math.max(1e-9, bid + ask);
}
function wallSideSkew(walls: Wall[]) {
  const bid = walls.filter((w) => w.side === "bid").reduce((s, w) => s + w.qty, 0);
  const ask = walls.filter((w) => w.side === "ask").reduce((s, w) => s + w.qty, 0);
  return (bid - ask) / Math.max(1e-9, bid + ask);
}
function shortTrend(klines: Kline[]) {
  if (klines.length < 10) return 0;
  const a = klines[klines.length - 10].close;
  const b = klines[klines.length - 1].close;
  return (b - a) / a;
}
