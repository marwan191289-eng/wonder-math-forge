// src/engine/fvgEngine.ts

import { Candle, FairValueGap } from './types';
import { mean, stdDev } from '../utils/math';

export function detectFairValueGaps(candles: Candle[]): FairValueGap[] {
  const fvgs: FairValueGap[] = [];
  const len = candles.length;
  const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / len;

  const gapSizes: number[] = [];
  for (let i = 1; i < len - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (curr.low > prev.high || curr.high < prev.low) {
      gapSizes.push(Math.abs(curr.low - prev.high) || Math.abs(curr.high - prev.low));
    }
  }
  const avgGap = mean(gapSizes);
  const stdGap = stdDev(gapSizes, avgGap);

  for (let i = 1; i < len - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    if (curr.low > prev.high) {
      const gapSize = curr.low - prev.high;
      const zScore = stdGap > 0 ? (gapSize - avgGap) / stdGap : 0;
      const fillProb = Math.max(0.2, Math.min(0.95, 0.7 - zScore * 0.1));
      const volumeRatio = Math.min(2, (curr.volume + prev.volume) / (2 * avgVolume));
      const strength = Math.min(100, (1 - fillProb) * 80 + volumeRatio * 20);

      const isFilled = next && next.low <= prev.high;
      const partialFill = next && next.low < curr.low && next.low > prev.high;

      fvgs.push({
        index: i,
        type: 'BULLISH_GAP',
        top: curr.low,
        bottom: prev.high,
        size: gapSize,
        isFilled,
        fillProbability: fillProb,
        strength: Math.round(strength),
        filledIndex: isFilled ? i + 1 : undefined,
        partialFill,
        partialFillIndex: partialFill ? i + 1 : undefined
      });
    }

    if (curr.high < prev.low) {
      const gapSize = prev.low - curr.high;
      const zScore = stdGap > 0 ? (gapSize - avgGap) / stdGap : 0;
      const fillProb = Math.max(0.2, Math.min(0.95, 0.7 - zScore * 0.1));
      const volumeRatio = Math.min(2, (curr.volume + prev.volume) / (2 * avgVolume));
      const strength = Math.min(100, (1 - fillProb) * 80 + volumeRatio * 20);

      const isFilled = next && next.high >= prev.low;
      const partialFill = next && next.high > curr.high && next.high < prev.low;

      fvgs.push({
        index: i,
        type: 'BEARISH_GAP',
        top: prev.low,
        bottom: curr.high,
        size: gapSize,
        isFilled,
        fillProbability: fillProb,
        strength: Math.round(strength),
        filledIndex: isFilled ? i + 1 : undefined,
        partialFill,
        partialFillIndex: partialFill ? i + 1 : undefined
      });
    }
  }
  return fvgs;
}
