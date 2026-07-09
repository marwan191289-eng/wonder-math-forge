import { z } from 'zod';

/**
 * Advanced Volume Analysis Engine
 * Provides insights into hidden buying/selling pressure, key price levels, and market structure
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface CumulativeVolumeDelta {
  timestamp: number;
  cvd: number;
  delta: number;
}

export interface VolumeProfileLevel {
  price: number;
  volume: number;
  isPOC: boolean; // Point of Control
  isVAH: boolean; // Value Area High
  isVAL: boolean; // Value Area Low
}

export interface VolumeProfile {
  levels: VolumeProfileLevel[];
  poc: number; // Price of Control
  vah: number; // Value Area High
  val: number; // Value Area Low
}

export interface MarketProfile {
  tpos: { price: number; count: number }[]; // Time Price Opportunity
  poc: number;
  vah: number;
  val: number;
}

// ============================================================================
// CUMULATIVE VOLUME DELTA (CVD)
// ============================================================================

/**
 * Calculate Cumulative Volume Delta (CVD)
 * Measures hidden buying/selling pressure by aggregating volume delta
 * Volume Delta = Buying Volume - Selling Volume
 */
export function calculateCVD(candles: Candle[]): CumulativeVolumeDelta[] {
  if (candles.length === 0) return [];

  let cumulativeDelta = 0;
  const cvdData: CumulativeVolumeDelta[] = [];

  for (const candle of candles) {
    // Simplified: Assume buying volume is (close - open) / (high - low) * volume
    // A more accurate calculation would require tick data or specific exchange data
    // More sophisticated simulation of aggressor-side volume from OHLCV
    // Assume volume distribution based on where price closed within the candle range
    let delta = 0;
    if (candle.high !== candle.low) { // Avoid division by zero
      const range = candle.high - candle.low;
      const closePosition = (candle.close - candle.low) / range; // 0 to 1
      const openPosition = (candle.open - candle.low) / range; // 0 to 1

      // Estimate buying/selling pressure based on candle body and wicks
      if (candle.close > candle.open) { // Bullish candle
        delta = candle.volume * (0.5 + (closePosition - openPosition) / 2); // More buying
      } else if (candle.close < candle.open) { // Bearish candle
        delta = -candle.volume * (0.5 + (openPosition - closePosition) / 2); // More selling
      } else { // Doji or flat candle
        delta = 0; // Neutral
      }
    } else { // Flat candle (open == high == low == close)
      delta = 0;
    }
    cumulativeDelta += delta;

    cvdData.push({
      timestamp: candle.timestamp,
      cvd: cumulativeDelta,
      delta: delta,
    });
  }

  return cvdData;
}

// ============================================================================
// VOLUME PROFILE
// ============================================================================

/**
 * Calculate Volume Profile
 * Identifies key price levels where significant volume was traded
 */
export function calculateVolumeProfile(candles: Candle[], priceTickSize: number = 0.01): VolumeProfile {
  if (candles.length === 0) {
    return { levels: [], poc: 0, vah: 0, val: 0 };
  }

  const priceVolumeMap: { [price: number]: number } = {};
  let totalVolume = 0;

  for (const candle of candles) {
    // Distribute volume more realistically based on price movement within the candle
    const priceRange = candle.high - candle.low;
    if (priceRange === 0) {
      const price = parseFloat(candle.close.toFixed(2));
      priceVolumeMap[price] = (priceVolumeMap[price] || 0) + candle.volume;
      totalVolume += candle.volume;
    } else {
      const priceStep = priceTickSize;
      const steps = Math.ceil(priceRange / priceStep);
      const volumePerStep = candle.volume / steps; // Define volumePerStep here
      // Distribute volume based on price action within the candle
      // More volume is allocated to prices closer to open/close or where price spent more time
      // This is a heuristic, a true absorption/distribution requires tick data
      // Simple distribution for now, more advanced logic can be added later
      // For absorption/distribution, we'd need to compare current volume at price with historical average
      // For now, just ensure accurate volume-at-price aggregation

      for (let i = 0; i < steps; i++) {
        const price = parseFloat((candle.low + i * priceStep).toFixed(2));
        priceVolumeMap[price] = (priceVolumeMap[price] || 0) + volumePerStep;
        totalVolume += volumePerStep;
      }
    }
  }

  const sortedPrices = Object.keys(priceVolumeMap).map(Number).sort((a, b) => a - b);

  const levels: VolumeProfileLevel[] = sortedPrices.map(price => ({
    price,
    volume: priceVolumeMap[price],
    isPOC: false,
    isVAH: false,
    isVAL: false,
  }));

  let poc = 0;
  let maxVolume = 0;
  for (const level of levels) {
    if (level.volume > maxVolume) {
      maxVolume = level.volume;
      poc = level.price;
    }
  }

  // Calculate Value Area (typically 70% of total volume around POC)
  const valueAreaVolume = totalVolume * 0.70;
  let vah = poc;
  let val = poc;

  // Sort levels by volume to find POC and then expand for VA
  const sortedLevelsByVolume = [...levels].sort((a, b) => b.volume - a.volume);
  const pocLevel = sortedLevelsByVolume.find(level => level.price === poc);

  let vaLevels: VolumeProfileLevel[] = [];
  let vaVolume = 0;

  if (pocLevel) {
    vaLevels.push(pocLevel);
    vaVolume += pocLevel.volume;
  }

  // Expand outwards from POC to find Value Area
  let currentIdx = 0;
  while (vaVolume < valueAreaVolume && currentIdx < sortedLevelsByVolume.length) {
    const nextLevel = sortedLevelsByVolume[currentIdx];
    if (!vaLevels.includes(nextLevel)) {
      vaLevels.push(nextLevel);
      vaVolume += nextLevel.volume;
    }
    currentIdx++;
  }

  // Determine VAH and VAL from vaLevels
  if (vaLevels.length > 0) {
    vah = Math.max(...vaLevels.map(level => level.price));
    val = Math.min(...vaLevels.map(level => level.price));
  }

  // Mark POC, VAH, VAL in the original levels array
  levels.forEach(level => {
    level.isPOC = level.price === poc;
    level.isVAH = level.price === vah;
    level.isVAL = level.price === val;
  });

  return { levels, poc, vah, val };
}

// ============================================================================
// MARKET PROFILE
// ============================================================================

/**
 * Calculate Market Profile
 * Uses Time Price Opportunity (TPO) to analyze market structure
 */
export function calculateMarketProfile(candles: Candle[], tpoIntervalMinutes: number = 30, priceTickSize: number = 0.01): MarketProfile {
  if (candles.length === 0) {
    return { tpos: [], poc: 0, vah: 0, val: 0 };
  }

  const tpoMap: { [price: number]: number } = {};
  const intervalMs = tpoIntervalMinutes * 60 * 1000;

  for (const candle of candles) {
    const intervalStart = Math.floor(candle.timestamp / intervalMs) * intervalMs;
    // Use the entire price range of the candle for TPO calculation
    const minPrice = Math.floor(candle.low / priceTickSize) * priceTickSize;
    const maxPrice = Math.ceil(candle.high / priceTickSize) * priceTickSize;

    for (let p = minPrice; p <= maxPrice; p += priceTickSize) {
      const price = parseFloat(p.toFixed(2));
      tpoMap[price] = (tpoMap[price] || 0) + 1;
    }
  }

  const sortedPrices = Object.keys(tpoMap).map(Number).sort((a, b) => a - b);

  let poc = 0;
  let maxTPOs = 0;
  for (const price of sortedPrices) {
    if (tpoMap[price] > maxTPOs) {
      maxTPOs = tpoMap[price];
      poc = price;
    }
  }

  // Simplified Value Area calculation for Market Profile
  const totalTPOs = Object.values(tpoMap).reduce((sum, count) => sum + count, 0);
  const valueAreaTPOs = totalTPOs * 0.70;
  let currentTPOs = 0;
  let vah = poc;
  let val = poc;

  // Expand upwards from POC
  for (let i = sortedPrices.indexOf(poc); i < sortedPrices.length; i++) {
    currentTPOs += tpoMap[sortedPrices[i]];
    vah = sortedPrices[i];
    if (currentTPOs >= valueAreaTPOs / 2) break;
  }

  // Expand downwards from POC
  currentTPOs = 0;
  for (let i = sortedPrices.indexOf(poc); i >= 0; i--) {
    currentTPOs += tpoMap[sortedPrices[i]];
    val = sortedPrices[i];
    if (currentTPOs >= valueAreaTPOs / 2) break;
  }

  const tpos = sortedPrices.map(price => ({
    price,
    count: tpoMap[price],
  }));

  return { tpos, poc, vah, val };
}

export default {
  calculateCVD,
  calculateVolumeProfile,
  calculateMarketProfile,
};
