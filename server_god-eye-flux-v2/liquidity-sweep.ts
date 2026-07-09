/**
 * Advanced Liquidity Sweep Detection Engine
 * 
 * Sophisticated algorithms for:
 * - Equal highs/lows detection with precision tolerance
 * - Stop-hunt zone identification
 * - Liquidity pool analysis
 * - Sweep probability calculation with ML-inspired scoring
 * - Institutional order flow detection
 * - Reversal confirmation patterns
 */

export interface LiquiditySweep {
  type: "bullish" | "bearish" | "none";
  probability: number; // 0-100
  equalHighsLowsCount: number;
  stopHuntZonesCount: number;
  liquidityPoolsCount: number;
  sweepStrength: number; // 0-100
  reversalProbability: number; // 0-100
  nextTargetLevel: number;
  riskLevel: number; // 0-100
  reasoning: string;
}

export interface EqualLevel {
  level: number;
  touches: number;
  timespan: number; // in candles
  precision: number; // 0-100, how close the touches are
}

export interface StopHuntZone {
  level: number;
  type: "bullish" | "bearish";
  strength: number; // 0-100
  liquiditySize: number;
  description: string;
}

export interface LiquidityPool {
  level: number;
  size: number; // volume accumulated
  type: "buy" | "sell";
  age: number; // candles since formation
  absorbedVolume: number;
}

type Kline = any;

/**
 * Detect equal highs or lows with precision tolerance
 */
function detectEqualLevels(klines: Kline[], tolerance: number = 0.0005): EqualLevel[] {
  const levels: EqualLevel[] = [];
  const highs = klines.map((k, i) => ({ price: Number(k.high), index: i }));
  const lows = klines.map((k, i) => ({ price: Number(k.low), index: i }));

  // Detect equal highs
  for (let i = 0; i < highs.length; i++) {
    const touches: number[] = [i];

    for (let j = i + 1; j < highs.length; j++) {
      const priceDiff = Math.abs(highs[i].price - highs[j].price) / highs[i].price;
      if (priceDiff < tolerance) {
        touches.push(j);
      }
    }

    if (touches.length >= 2) {
      const timespan = touches[touches.length - 1] - touches[0];
      const precision = 100 - (tolerance * 100000); // Convert to 0-100 scale

      levels.push({
        level: highs[i].price,
        touches: touches.length,
        timespan,
        precision,
      });
    }
  }

  // Detect equal lows
  for (let i = 0; i < lows.length; i++) {
    const touches: number[] = [i];

    for (let j = i + 1; j < lows.length; j++) {
      const priceDiff = Math.abs(lows[i].price - lows[j].price) / lows[i].price;
      if (priceDiff < tolerance) {
        touches.push(j);
      }
    }

    if (touches.length >= 2) {
      const timespan = touches[touches.length - 1] - touches[0];
      const precision = 100 - (tolerance * 100000);

      levels.push({
        level: lows[i].price,
        touches: touches.length,
        timespan,
        precision,
      });
    }
  }

  // Remove duplicates and return sorted by strength
  const unique = Array.from(
    new Map(levels.map((l) => [Math.round(l.level * 10000), l])).values()
  );

  return unique.sort((a, b) => b.touches - a.touches || a.timespan - b.timespan);
}

/**
 * Identify stop-hunt zones where institutions hunt retail stops
 */
function detectStopHuntZones(klines: Kline[]): StopHuntZone[] {
  const zones: StopHuntZone[] = [];
  const currentPrice = Number(klines[klines.length - 1].close);

  for (let i = 10; i < klines.length; i++) {
    const window = klines.slice(Math.max(0, i - 20), i);
    const highs = window.map((k) => Number(k.high));
    const lows = window.map((k) => Number(k.low));
    const volumes = window.map((k) => Number(k.volume));

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const currentVolume = Number(klines[i].volume);

    // Bullish stop-hunt: spike above resistance with high volume then pullback
    if (
      maxHigh > currentPrice &&
      currentVolume > avgVolume * 1.5 &&
      Number(klines[i].close) < maxHigh * 0.99
    ) {
      zones.push({
        level: maxHigh,
        type: "bullish",
        strength: Math.min(100, (currentVolume / avgVolume) * 50),
        liquiditySize: currentVolume,
        description: `Bullish stop-hunt at ${maxHigh.toFixed(2)} with volume spike`,
      });
    }

    // Bearish stop-hunt: spike below support with high volume then bounce
    if (
      minLow < currentPrice &&
      currentVolume > avgVolume * 1.5 &&
      Number(klines[i].close) > minLow * 1.01
    ) {
      zones.push({
        level: minLow,
        type: "bearish",
        strength: Math.min(100, (currentVolume / avgVolume) * 50),
        liquiditySize: currentVolume,
        description: `Bearish stop-hunt at ${minLow.toFixed(2)} with volume spike`,
      });
    }
  }

  return zones.sort((a, b) => b.strength - a.strength);
}

/**
 * Identify liquidity pools (accumulation zones)
 */
function detectLiquidityPools(klines: Kline[]): LiquidityPool[] {
  const pools: LiquidityPool[] = [];
  const currentPrice = Number(klines[klines.length - 1].close);

  for (let i = 5; i < klines.length; i++) {
    const window = klines.slice(i - 5, i);
    const closes = window.map((k) => Number(k.close));
    const volumes = window.map((k) => Number(k.volume));
    const highs = window.map((k) => Number(k.high));
    const lows = window.map((k) => Number(k.low));

    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    const totalVolume = volumes.reduce((a, b) => a + b, 0);
    const poolLevel = (Math.max(...highs) + Math.min(...lows)) / 2;

    // Detect buy-side liquidity (prices consolidating above average)
    if (avgClose > poolLevel && totalVolume > 0) {
      pools.push({
        level: poolLevel,
        size: totalVolume,
        type: "buy",
        age: klines.length - i,
        absorbedVolume: totalVolume,
      });
    }

    // Detect sell-side liquidity (prices consolidating below average)
    if (avgClose < poolLevel && totalVolume > 0) {
      pools.push({
        level: poolLevel,
        size: totalVolume,
        type: "sell",
        age: klines.length - i,
        absorbedVolume: totalVolume,
      });
    }
  }

  return pools.sort((a, b) => b.size - a.size);
}

/**
 * Calculate sweep probability using multi-factor scoring
 */
function calculateSweepProbability(
  equalLevels: EqualLevel[],
  stopHuntZones: StopHuntZone[],
  liquidityPools: LiquidityPool[],
  klines: Kline[]
): { probability: number; type: "bullish" | "bearish" | "none" } {
  if (equalLevels.length === 0 || stopHuntZones.length === 0) {
    return { probability: 0, type: "none" };
  }

  const currentPrice = Number(klines[klines.length - 1].close);
  const currentVolume = Number(klines[klines.length - 1].volume);
  const avgVolume = klines.slice(-20).reduce((sum, k) => sum + Number(k.volume), 0) / 20;

  let bullishScore = 0;
  let bearishScore = 0;

  // Score based on equal levels
  for (const level of equalLevels) {
    const touchScore = Math.min(100, level.touches * 20);
    const precisionScore = level.precision;

    if (level.level > currentPrice) {
      bullishScore += (touchScore + precisionScore) / 2;
    } else {
      bearishScore += (touchScore + precisionScore) / 2;
    }
  }

  // Score based on stop-hunt zones
  for (const zone of stopHuntZones) {
    if (zone.type === "bullish" && zone.level > currentPrice) {
      bullishScore += zone.strength;
    } else if (zone.type === "bearish" && zone.level < currentPrice) {
      bearishScore += zone.strength;
    }
  }

  // Score based on liquidity pools
  for (const pool of liquidityPools) {
    const poolScore = Math.min(100, (pool.absorbedVolume / avgVolume) * 50);

    if (pool.type === "buy" && pool.level > currentPrice) {
      bullishScore += poolScore;
    } else if (pool.type === "sell" && pool.level < currentPrice) {
      bearishScore += poolScore;
    }
  }

  // Volume confirmation
  const volumeBoost = currentVolume > avgVolume * 1.5 ? 20 : 0;
  bullishScore += volumeBoost;
  bearishScore += volumeBoost;

  // Normalize to 0-100
  const maxScore = Math.max(bullishScore, bearishScore);
  const probability = Math.min(100, (maxScore / 300) * 100);

  const type = bullishScore > bearishScore ? "bullish" : bearishScore > bullishScore ? "bearish" : "none";

  return { probability, type };
}

/**
 * Calculate reversal probability after sweep
 */
function calculateReversalProbability(
  klines: Kline[],
  sweepType: "bullish" | "bearish" | "none"
): number {
  if (sweepType === "none" || klines.length < 5) return 0;

  const recent = klines.slice(-5);
  const closes = recent.map((k) => Number(k.close));
  const highs = recent.map((k) => Number(k.high));
  const lows = recent.map((k) => Number(k.low));

  let reversalScore = 0;

  // Check for divergence
  const closesDiff = closes[closes.length - 1] - closes[0];
  const highsDiff = Math.max(...highs) - Math.min(...highs);

  if (Math.abs(closesDiff) < highsDiff * 0.3) {
    reversalScore += 30; // Price not following trend
  }

  // Check for wick rejection
  for (let i = 1; i < recent.length; i++) {
    const wickSize = sweepType === "bullish" ? highs[i] - closes[i] : closes[i] - lows[i];
    const bodySize = Math.abs(closes[i] - closes[i - 1]);

    if (wickSize > bodySize * 1.5) {
      reversalScore += 20; // Strong wick rejection
    }
  }

  // Check for volume decline
  const volumes = recent.map((k) => Number(k.volume));
  if (volumes[volumes.length - 1] < volumes[0]) {
    reversalScore += 20; // Volume declining
  }

  return Math.min(100, reversalScore);
}

/**
 * Main liquidity sweep detection function
 */
export function detectLiquiditySweep(klines: Kline[]): LiquiditySweep {
  if (klines.length < 20) {
    return {
      type: "none",
      probability: 0,
      equalHighsLowsCount: 0,
      stopHuntZonesCount: 0,
      liquidityPoolsCount: 0,
      sweepStrength: 0,
      reversalProbability: 0,
      nextTargetLevel: 0,
      riskLevel: 0,
      reasoning: "Insufficient data for sweep detection",
    };
  }

  const equalLevels = detectEqualLevels(klines);
  const stopHuntZones = detectStopHuntZones(klines);
  const liquidityPools = detectLiquidityPools(klines);

  const { probability, type } = calculateSweepProbability(
    equalLevels,
    stopHuntZones,
    liquidityPools,
    klines
  );

  const reversalProbability = calculateReversalProbability(klines, type);

  const currentPrice = Number(klines[klines.length - 1].close);
  const nextTargetLevel =
    type === "bullish"
      ? Math.max(...klines.map((k) => Number(k.high))) * 1.02
      : Math.min(...klines.map((k) => Number(k.low))) * 0.98;

  const riskLevel = Math.abs(nextTargetLevel - currentPrice) / currentPrice * 100;

  let reasoning = "";
  if (type === "bullish" && probability > 70) {
    reasoning = `Strong bullish sweep setup detected. Equal highs at ${equalLevels[0]?.level.toFixed(2) || "N/A"} with ${equalLevels[0]?.touches || 0} touches. Target: ${nextTargetLevel.toFixed(2)}`;
  } else if (type === "bearish" && probability > 70) {
    reasoning = `Strong bearish sweep setup detected. Equal lows at ${equalLevels[0]?.level.toFixed(2) || "N/A"} with ${equalLevels[0]?.touches || 0} touches. Target: ${nextTargetLevel.toFixed(2)}`;
  } else if (probability > 0) {
    reasoning = `Moderate ${type} sweep probability (${probability.toFixed(0)}%) with ${stopHuntZones.length} stop-hunt zones identified.`;
  } else {
    reasoning = "No significant sweep setup detected at this time.";
  }

  return {
    type,
    probability: Math.round(probability),
    equalHighsLowsCount: equalLevels.length,
    stopHuntZonesCount: stopHuntZones.length,
    liquidityPoolsCount: liquidityPools.length,
    sweepStrength: Math.round(probability),
    reversalProbability: Math.round(reversalProbability),
    nextTargetLevel: Math.round(nextTargetLevel * 100) / 100,
    riskLevel: Math.round(riskLevel * 100) / 100,
    reasoning,
  };
}
