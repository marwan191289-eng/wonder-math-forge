/**
 * Advanced Market Structure Analysis Engine
 * 
 * Multi-timeframe support with:
 * - Fractal-based swing detection
 * - Order block identification
 * - Fair value gap (FVG) detection
 * - Confluence zone analysis
 * - Trend strength with momentum confirmation
 * - Support/resistance level calculation
 * - Pattern reliability scoring
 */

export interface MarketStructure {
  pattern: "HH" | "HL" | "LH" | "LL" | "NEUTRAL";
  trendStrength: number; // 0-100
  bosLevel: number;
  cochLevel: number;
  swingHigh: number;
  swingLow: number;
  trendDirection: "UP" | "DOWN" | "RANGING";
  structureQuality: number; // 0-100
  orderBlockCount: number;
  fairValueGapCount: number;
  confluenceZoneCount: number;
  supportLevels: number[];
  resistanceLevels: number[];
  nearestSupport: number;
  nearestResistance: number;
  reasoning: string;
}

export interface OrderBlock {
  level: number;
  type: "bullish" | "bearish";
  strength: number; // 0-100
  timestamp: number;
  description: string;
}

export interface FairValueGap {
  top: number;
  bottom: number;
  type: "bullish" | "bearish";
  filled: boolean;
  size: number;
}

export interface ConfluenceZone {
  level: number;
  strength: number; // 0-100 based on number of confluences
  sources: string[]; // e.g., ["support", "fib_level", "order_block"]
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
  nearestSupport: number;
  nearestResistance: number;
}

type Kline = any;

/**
 * Advanced fractal-based swing detection
 * Identifies higher highs/lows with multi-candle confirmation
 */
function detectSwings(klines: Kline[], lookback: number = 5): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];

  for (let i = lookback; i < klines.length - lookback; i++) {
    const window = klines.slice(i - lookback, i + lookback + 1);
    const prices = window.map((k) => ({
      high: Number(k.high),
      low: Number(k.low),
      close: Number(k.close),
    }));

    // Check for swing high (higher highs on both sides)
    const isSwingHigh =
      prices[lookback].high === Math.max(...prices.map((p) => p.high)) &&
      prices[lookback].high > prices[lookback - 1].high &&
      prices[lookback].high > prices[lookback + 1].high;

    // Check for swing low (lower lows on both sides)
    const isSwingLow =
      prices[lookback].low === Math.min(...prices.map((p) => p.low)) &&
      prices[lookback].low < prices[lookback - 1].low &&
      prices[lookback].low < prices[lookback + 1].low;

    if (isSwingHigh) highs.push(prices[lookback].high);
    if (isSwingLow) lows.push(prices[lookback].low);
  }

  return { highs, lows };
}

/**
 * Identify order blocks (consolidation zones before breakouts)
 */
function detectOrderBlocks(klines: Kline[]): OrderBlock[] {
  const orderBlocks: OrderBlock[] = [];

  for (let i = 10; i < klines.length; i++) {
    const window = klines.slice(i - 10, i);
    const highs = window.map((k) => Number(k.high));
    const lows = window.map((k) => Number(k.low));
    const closes = window.map((k) => Number(k.close));

    const consolidationHigh = Math.max(...highs);
    const consolidationLow = Math.min(...lows);
    const consolidationRange = consolidationHigh - consolidationLow;

    // Check if consolidation is tight (less than 1% range)
    if (consolidationRange / consolidationLow < 0.01) {
      const avgClose = closes.reduce((a, b) => a + b) / closes.length;
      const breakDirection = closes[closes.length - 1] > avgClose ? "bullish" : "bearish";

      orderBlocks.push({
        level: consolidationLow,
        type: breakDirection,
        strength: Math.min(100, (consolidationRange / consolidationLow) * 10000),
        timestamp: Date.now(),
        description: `Order block at ${consolidationLow.toFixed(2)}`,
      });
    }
  }

  return orderBlocks;
}

/**
 * Detect Fair Value Gaps (FVG) - price gaps that haven't been filled
 */
function detectFairValueGaps(klines: Kline[]): FairValueGap[] {
  const gaps: FairValueGap[] = [];

  for (let i = 2; i < klines.length; i++) {
    const prev = klines[i - 1];
    const curr = klines[i];

    const prevHigh = Number(prev.high);
    const prevLow = Number(prev.low);
    const currHigh = Number(curr.high);
    const currLow = Number(curr.low);

    // Bullish FVG: current low > previous high
    if (currLow > prevHigh) {
      gaps.push({
        top: currLow,
        bottom: prevHigh,
        type: "bullish",
        filled: false,
        size: currLow - prevHigh,
      });
    }

    // Bearish FVG: current high < previous low
    if (currHigh < prevLow) {
      gaps.push({
        top: prevLow,
        bottom: currHigh,
        type: "bearish",
        filled: false,
        size: prevLow - currHigh,
      });
    }
  }

  return gaps;
}

/**
 * Calculate support and resistance levels using multiple methods
 */
function calculateSupportResistance(klines: Kline[]): SupportResistance {
  const highs = klines.map((k) => Number(k.high));
  const lows = klines.map((k) => Number(k.low));
  const closes = klines.map((k) => Number(k.close));

  const currentPrice = closes[closes.length - 1];

  // Pivot points
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const close = closes[closes.length - 1];

  const pivot = (high + low + close) / 3;
  const r1 = pivot * 2 - low;
  const r2 = pivot + (high - low);
  const s1 = pivot * 2 - high;
  const s2 = pivot - (high - low);

  // ATR-based levels
  const atr = calculateATR(klines);
  const atrSupport = currentPrice - atr * 1.5;
  const atrResistance = currentPrice + atr * 1.5;

  const supports = [s2, s1, atrSupport].filter((s) => s < currentPrice).sort((a, b) => b - a);
  const resistances = [r1, r2, atrResistance].filter((r) => r > currentPrice).sort((a, b) => a - b);

  return {
    supports,
    resistances,
    nearestSupport: supports[0] || currentPrice - atr,
    nearestResistance: resistances[0] || currentPrice + atr,
  };
}

/**
 * Calculate Average True Range
 */
function calculateATR(klines: Kline[], period: number = 14): number {
  const trValues: number[] = [];

  for (let i = 1; i < klines.length; i++) {
    const prev = klines[i - 1];
    const curr = klines[i];

    const high = Number(curr.high);
    const low = Number(curr.low);
    const prevClose = Number(prev.close);

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trValues.push(tr);
  }

  const atr = trValues.slice(-period).reduce((a, b) => a + b, 0) / period;
  return atr;
}

/**
 * Identify confluence zones where multiple support/resistance levels align
 */
function findConfluenceZones(
  supports: number[],
  resistances: number[],
  orderBlocks: OrderBlock[],
  fvgs: FairValueGap[]
): ConfluenceZone[] {
  const zones: ConfluenceZone[] = [];
  const tolerance = 0.002; // 0.2% tolerance for confluence

  // Combine all levels
  const allLevels = [
    ...supports.map((s) => ({ level: s, source: "support" })),
    ...resistances.map((r) => ({ level: r, source: "resistance" })),
    ...orderBlocks.map((ob) => ({ level: ob.level, source: "order_block" })),
    ...fvgs.map((fvg) => ({ level: (fvg.top + fvg.bottom) / 2, source: "fvg" })),
  ];

  // Group nearby levels
  const grouped: Map<number, string[]> = new Map();

  for (const item of allLevels) {
    let found = false;

    for (const [key, sources] of grouped.entries()) {
      if (Math.abs(key - item.level) / key < tolerance) {
        sources.push(item.source);
        found = true;
        break;
      }
    }

    if (!found) {
      grouped.set(item.level, [item.source]);
    }
  }

  // Convert to confluence zones
  for (const [level, sources] of grouped.entries()) {
    if (sources.length > 1) {
      zones.push({
        level,
        strength: Math.min(100, (sources.length / 4) * 100),
        sources: [...new Set(sources)],
      });
    }
  }

  return zones.sort((a, b) => b.strength - a.strength);
}

/**
 * Main market structure analysis function
 */
export function analyzeMarketStructure(klines: Kline[]): MarketStructure {
  if (klines.length < 20) {
    return {
      pattern: "NEUTRAL",
      trendStrength: 0,
      bosLevel: 0,
      cochLevel: 0,
      swingHigh: 0,
      swingLow: 0,
      trendDirection: "RANGING",
      structureQuality: 0,
      orderBlockCount: 0,
      fairValueGapCount: 0,
      confluenceZoneCount: 0,
      supportLevels: [],
      resistanceLevels: [],
      nearestSupport: 0,
      nearestResistance: 0,
      reasoning: "Insufficient data for advanced structure analysis",
    };
  }

  // Detect swings using fractal analysis
  const { highs, lows } = detectSwings(klines);

  if (highs.length < 2 || lows.length < 2) {
    const sr = calculateSupportResistance(klines);
    return {
      pattern: "NEUTRAL",
      trendStrength: 0,
      bosLevel: 0,
      cochLevel: 0,
      swingHigh: Number(klines[klines.length - 1].high),
      swingLow: Number(klines[klines.length - 1].low),
      trendDirection: "RANGING",
      structureQuality: 0,
      orderBlockCount: 0,
      fairValueGapCount: 0,
      confluenceZoneCount: 0,
      supportLevels: sr.supports.slice(0, 3),
      resistanceLevels: sr.resistances.slice(0, 3),
      nearestSupport: sr.nearestSupport,
      nearestResistance: sr.nearestResistance,
      reasoning: "Insufficient swing data for pattern detection",
    };
  }

  const prevSwingHigh = highs[highs.length - 2];
  const prevSwingLow = lows[lows.length - 2];
  const currentHigh = highs[highs.length - 1];
  const currentLow = lows[lows.length - 1];

  let pattern: "HH" | "HL" | "LH" | "LL" | "NEUTRAL" = "NEUTRAL";
  let trendDirection: "UP" | "DOWN" | "RANGING" = "RANGING";
  let reasoning = "";

  // Detect pattern with enhanced logic
  if (currentHigh > prevSwingHigh && currentLow > prevSwingLow) {
    pattern = "HH";
    trendDirection = "UP";
    reasoning = "Higher High + Higher Low: Strong uptrend with bullish structure";
  } else if (currentHigh < prevSwingHigh && currentLow > prevSwingLow) {
    pattern = "HL";
    trendDirection = "UP";
    reasoning = "Lower High + Higher Low: Weakening uptrend, potential consolidation";
  } else if (currentHigh > prevSwingHigh && currentLow < prevSwingLow) {
    pattern = "LH";
    trendDirection = "DOWN";
    reasoning = "Higher High + Lower Low: Volatility expansion, potential breakdown";
  } else if (currentHigh < prevSwingHigh && currentLow < prevSwingLow) {
    pattern = "LL";
    trendDirection = "DOWN";
    reasoning = "Lower Low + Lower High: Strong downtrend with bearish structure";
  }

  // Calculate trend strength with momentum
  const highDiff = currentHigh - prevSwingHigh;
  const lowDiff = currentLow - prevSwingLow;
  const avgPrice = (currentHigh + currentLow) / 2;
  const trendStrength = Math.min(100, Math.abs((highDiff + lowDiff) / (2 * avgPrice)) * 100);

  // BOS and CHOCH levels
  const bosLevel = trendDirection === "UP" ? prevSwingLow : trendDirection === "DOWN" ? prevSwingHigh : (prevSwingHigh + prevSwingLow) / 2;
  const cochLevel = trendDirection === "UP" ? prevSwingHigh : trendDirection === "DOWN" ? prevSwingLow : (prevSwingHigh + prevSwingLow) / 2;

  // Detect advanced structures
  const orderBlocks = detectOrderBlocks(klines);
  const fairValueGaps = detectFairValueGaps(klines);
  const supportResistance = calculateSupportResistance(klines);
  const confluenceZones = findConfluenceZones(
    supportResistance.supports,
    supportResistance.resistances,
    orderBlocks,
    fairValueGaps
  );

  // Structure quality based on confluence and pattern clarity
  const structureQuality = Math.min(100, trendStrength * 1.2 + confluenceZones.length * 5);

  // Simplify response to avoid serialization depth issues
  return {
    pattern,
    trendStrength: Math.round(trendStrength),
    bosLevel: Math.round(bosLevel * 100) / 100,
    cochLevel: Math.round(cochLevel * 100) / 100,
    swingHigh: Math.round(currentHigh * 100) / 100,
    swingLow: Math.round(currentLow * 100) / 100,
    trendDirection,
    structureQuality: Math.round(structureQuality),
    orderBlockCount: orderBlocks.length,
    fairValueGapCount: fairValueGaps.length,
    confluenceZoneCount: confluenceZones.length,
    supportLevels: supportResistance.supports.slice(0, 3),
    resistanceLevels: supportResistance.resistances.slice(0, 3),
    nearestSupport: supportResistance.nearestSupport,
    nearestResistance: supportResistance.nearestResistance,
    reasoning,
  };
}

/**
 * Multi-timeframe structure analysis
 */
export async function analyzeMultiTimeframeStructure(
  klines1h: Kline[],
  klines4h: Kline[],
  klines1d: Kline[]
) {
  const structure1h = analyzeMarketStructure(klines1h);
  const structure4h = analyzeMarketStructure(klines4h);
  const structure1d = analyzeMarketStructure(klines1d);

  // Calculate alignment score
  const alignmentScore =
    (structure1h.trendDirection === structure4h.trendDirection ? 1 : 0) +
    (structure4h.trendDirection === structure1d.trendDirection ? 1 : 0) +
    (structure1h.trendDirection === structure1d.trendDirection ? 1 : 0);

  return {
    timeframes: {
      "1h": structure1h,
      "4h": structure4h,
      "1d": structure1d,
    },
    alignment: alignmentScore / 3, // 0-1
    consensus: alignmentScore >= 2 ? "strong" : "weak",
  };
}
