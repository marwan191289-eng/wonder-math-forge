/**
 * Smart Money Concepts (SMC) Detection Engine
 * Identifies key SMC patterns: BOS, CHOCH, Fair Value Gaps, Order Blocks
 */

import type { BinanceKline } from './binance-client';

export interface FairValueGap {
  type: 'bullish' | 'bearish';
  startIndex: number;
  gapTop: number;
  gapBottom: number;
  gapSize: number;
  gapSizePct: number;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  startIndex: number;
  high: number;
  low: number;
  close: number;
  strength: number; // 0-100
}

export interface BreakOfStructure {
  type: 'bullish' | 'bearish';
  index: number;
  price: number;
  previousStructure: number;
}

export interface ChangeOfCharacter {
  type: 'bullish' | 'bearish';
  index: number;
  price: number;
  reason: string;
}

export interface SMCAnalysis {
  trend: 'uptrend' | 'downtrend' | 'ranging';
  bosLevels: BreakOfStructure[];
  chochLevels: ChangeOfCharacter[];
  fvgs: FairValueGap[];
  orderBlocks: OrderBlock[];
  liquidityLevels: number[];
}

/**
 * Detect trend direction from klines
 */
export function detectTrend(klines: BinanceKline[], period: number = 20): 'uptrend' | 'downtrend' | 'ranging' {
  if (klines.length < period) return 'ranging';

  const recent = klines.slice(-period);
  const closes = recent.map(k => parseFloat(k.close));
  const highs = recent.map(k => parseFloat(k.high));
  const lows = recent.map(k => parseFloat(k.low));

  // Check for higher highs and higher lows (uptrend)
  let higherHighs = 0;
  let higherLows = 0;
  for (let i = 1; i < recent.length; i++) {
    if (highs[i] > highs[i - 1]) higherHighs++;
    if (lows[i] > lows[i - 1]) higherLows++;
  }

  // Check for lower highs and lower lows (downtrend)
  let lowerHighs = 0;
  let lowerLows = 0;
  for (let i = 1; i < recent.length; i++) {
    if (highs[i] < highs[i - 1]) lowerHighs++;
    if (lows[i] < lows[i - 1]) lowerLows++;
  }

  const uptrendScore = higherHighs + higherLows;
  const downtrendScore = lowerHighs + lowerLows;

  if (uptrendScore > downtrendScore + 3) return 'uptrend';
  if (downtrendScore > uptrendScore + 3) return 'downtrend';
  return 'ranging';
}

/**
 * Detect Fair Value Gaps (FVG)
 * A gap between candles that hasn't been filled
 */
export function detectFairValueGaps(klines: BinanceKline[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];

  if (klines.length < 3) return fvgs;

  for (let i = 2; i < klines.length; i++) {
    const prev = klines[i - 2];
    const curr = klines[i - 1];
    const next = klines[i];

    const prevHigh = parseFloat(prev.high);
    const prevLow = parseFloat(prev.low);
    const currHigh = parseFloat(curr.high);
    const currLow = parseFloat(curr.low);
    const nextHigh = parseFloat(next.high);
    const nextLow = parseFloat(next.low);

    // Bullish FVG: gap up (current low > previous high)
    if (currLow > prevHigh && nextLow > prevHigh) {
      const gapTop = currLow;
      const gapBottom = prevHigh;
      const gapSize = gapTop - gapBottom;
      const gapSizePct = (gapSize / prevHigh) * 100;

      fvgs.push({
        type: 'bullish',
        startIndex: i - 2,
        gapTop,
        gapBottom,
        gapSize,
        gapSizePct,
      });
    }

    // Bearish FVG: gap down (current high < previous low)
    if (currHigh < prevLow && nextHigh < prevLow) {
      const gapTop = prevLow;
      const gapBottom = currHigh;
      const gapSize = gapTop - gapBottom;
      const gapSizePct = (gapSize / prevLow) * 100;

      fvgs.push({
        type: 'bearish',
        startIndex: i - 2,
        gapTop,
        gapBottom,
        gapSize,
        gapSizePct,
      });
    }
  }

  return fvgs;
}

/**
 * Detect Order Blocks
 * Strong impulse candles that act as support/resistance
 */
export function detectOrderBlocks(klines: BinanceKline[], minStrength: number = 0.5): OrderBlock[] {
  const blocks: OrderBlock[] = [];

  if (klines.length < 5) return blocks;

  for (let i = 1; i < klines.length - 1; i++) {
    const prev = klines[i - 1];
    const curr = klines[i];
    const next = klines[i + 1];

    const prevClose = parseFloat(prev.close);
    const currOpen = parseFloat(curr.open);
    const currClose = parseFloat(curr.close);
    const currHigh = parseFloat(curr.high);
    const currLow = parseFloat(curr.low);
    const nextOpen = parseFloat(next.open);

    const currRange = currHigh - currLow;
    const bodySize = Math.abs(currClose - currOpen);
    const bodyRatio = bodySize / currRange;

    // Bullish order block: strong up candle followed by pullback
    if (currClose > currOpen && bodyRatio > 0.7 && nextOpen < currClose) {
      const strength = bodyRatio * 100;

      blocks.push({
        type: 'bullish',
        startIndex: i,
        high: currHigh,
        low: currLow,
        close: currClose,
        strength: Math.min(100, strength),
      });
    }

    // Bearish order block: strong down candle followed by bounce
    if (currClose < currOpen && bodyRatio > 0.7 && nextOpen > currClose) {
      const strength = bodyRatio * 100;

      blocks.push({
        type: 'bearish',
        startIndex: i,
        high: currHigh,
        low: currLow,
        close: currClose,
        strength: Math.min(100, strength),
      });
    }
  }

  return blocks.filter(b => b.strength >= minStrength * 100);
}

/**
 * Detect Break of Structure (BOS)
 * When price breaks through a previous swing high/low
 */
export function detectBreakOfStructure(klines: BinanceKline[], lookback: number = 20): BreakOfStructure[] {
  const bos: BreakOfStructure[] = [];

  if (klines.length < lookback + 1) return bos;

  const recent = klines.slice(-lookback);
  const highs = recent.map(k => parseFloat(k.high));
  const lows = recent.map(k => parseFloat(k.low));

  // Find swing highs and lows
  const swingHighs: { index: number; price: number }[] = [];
  const swingLows: { index: number; price: number }[] = [];

  for (let i = 1; i < highs.length - 1; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1]) {
      swingHighs.push({ index: i, price: highs[i] });
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1]) {
      swingLows.push({ index: i, price: lows[i] });
    }
  }

  // Check for BOS at the end
  const lastHigh = highs[highs.length - 1];
  const lastLow = lows[lows.length - 1];

  if (swingHighs.length > 0) {
    const lastSwingHigh = swingHighs[swingHighs.length - 1];
    if (lastHigh > lastSwingHigh.price) {
      bos.push({
        type: 'bullish',
        index: klines.length - 1,
        price: lastHigh,
        previousStructure: lastSwingHigh.price,
      });
    }
  }

  if (swingLows.length > 0) {
    const lastSwingLow = swingLows[swingLows.length - 1];
    if (lastLow < lastSwingLow.price) {
      bos.push({
        type: 'bearish',
        index: klines.length - 1,
        price: lastLow,
        previousStructure: lastSwingLow.price,
      });
    }
  }

  return bos;
}

/**
 * Detect Change of Character (CHOCH)
 * When the character of price action changes (trend reversal)
 */
export function detectChangeOfCharacter(klines: BinanceKline[], period: number = 10): ChangeOfCharacter[] {
  const choch: ChangeOfCharacter[] = [];

  if (klines.length < period + 1) return choch;

  const recent = klines.slice(-period - 1);
  const closes = recent.map(k => parseFloat(k.close));

  // Analyze trend direction change
  let prevTrend: 'up' | 'down' | null = null;
  let trendChangeIndex = -1;

  for (let i = 1; i < closes.length; i++) {
    const currTrend = closes[i] > closes[i - 1] ? 'up' : 'down';

    if (prevTrend && prevTrend !== currTrend) {
      trendChangeIndex = i;
      break;
    }

    prevTrend = currTrend;
  }

  if (trendChangeIndex > 0) {
    const price = closes[trendChangeIndex];
    const prevTrend = closes[trendChangeIndex] > closes[trendChangeIndex - 1] ? 'up' : 'down';

    choch.push({
      type: prevTrend === 'up' ? 'bullish' : 'bearish',
      index: klines.length - (period - trendChangeIndex),
      price,
      reason: `Trend changed from ${prevTrend === 'up' ? 'downtrend' : 'uptrend'} to ${prevTrend === 'up' ? 'uptrend' : 'downtrend'}`,
    });
  }

  return choch;
}

/**
 * Identify liquidity levels (support/resistance)
 */
export function identifyLiquidityLevels(klines: BinanceKline[], period: number = 50): number[] {
  if (klines.length < period) return [];

  const recent = klines.slice(-period);
  const highs = recent.map(k => parseFloat(k.high));
  const lows = recent.map(k => parseFloat(k.low));

  const levels: number[] = [];

  // Find local highs and lows
  for (let i = 2; i < recent.length - 2; i++) {
    // Local high
    if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 2]) {
      levels.push(highs[i]);
    }

    // Local low
    if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 2]) {
      levels.push(lows[i]);
    }
  }

  // Remove duplicates and sort
  return Array.from(new Set(levels)).sort((a, b) => a - b);
}

/**
 * Comprehensive SMC analysis
 */
export function analyzeSMC(klines: BinanceKline[]): SMCAnalysis {
  const trend = detectTrend(klines);
  const bosLevels = detectBreakOfStructure(klines);
  const chochLevels = detectChangeOfCharacter(klines);
  const fvgs = detectFairValueGaps(klines);
  const orderBlocks = detectOrderBlocks(klines);
  const liquidityLevels = identifyLiquidityLevels(klines);

  return {
    trend,
    bosLevels,
    chochLevels,
    fvgs,
    orderBlocks,
    liquidityLevels,
  };
}
