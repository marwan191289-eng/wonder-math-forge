// src/engine/pivots.ts

import { Candle, Pivot } from './types';
import { calculateATR, calculateSmaSlope } from './math';

export interface PivotParams {
  leftBars: number;
  rightBars: number;
  threshold: number;
  atr: number;
  volatilityRatio: number;
  minDevFactor: number;
}

export function getDynamicPivotParams(candles: Candle[], atrPeriod: number = 14, tfHours: number = 1): PivotParams {
  const atr = calculateATR(candles, atrPeriod);
  const avgPrice = candles[candles.length - 1]?.close || 1;
  const volatilityRatio = atr / avgPrice;
  const baseBars = Math.max(3, Math.min(8, Math.round(5 * (1 + Math.log2(tfHours)))));
  const leftBars = Math.max(3, Math.min(8, Math.round(baseBars * (1 + volatilityRatio * 2))));
  const rightBars = leftBars;
  const thresholdPercent = Math.max(0.008, Math.min(0.06, volatilityRatio * 1.1));
  const minDevFactor = Math.max(0.5, Math.min(2.0, 1 + volatilityRatio * 2));
  return { leftBars, rightBars, threshold: thresholdPercent, atr, volatilityRatio, minDevFactor };
}

export function getPivotPoints(
  data: Candle[],
  leftBars: number = 5,
  rightBars: number = 5,
  deviationThreshold: number = 0.03,
  minDevFactor: number = 1.0
): Pivot[] {
  if (data.length < leftBars + rightBars + 1) return [];

  const rawPivots: Pivot[] = [];
  const len = data.length;
  const atr = calculateATR(data, 14);
  const minDeviation = atr * minDevFactor;
  const prices = data.map(c => c.close);
  const trendSlope = calculateSmaSlope(prices, 20);
  const overallDirection = trendSlope > 0 ? 'UP' : 'DOWN';

  for (let i = leftBars; i < len - rightBars; i++) {
    const leftHighs = data.slice(i - leftBars, i).map(c => c.high);
    const rightHighs = data.slice(i + 1, i + rightBars + 1).map(c => c.high);
    const leftLows = data.slice(i - leftBars, i).map(c => c.low);
    const rightLows = data.slice(i + 1, i + rightBars + 1).map(c => c.low);

    if (leftHighs.length === 0 || rightHighs.length === 0) continue;

    const isHigh = data[i].high > Math.max(...leftHighs) && data[i].high > Math.max(...rightHighs);
    const isLow = data[i].low < Math.min(...leftLows) && data[i].low < Math.min(...rightLows);

    if (isHigh || isLow) {
      const type = isHigh ? 'HIGH' : 'LOW';
      const price = isHigh ? data[i].high : data[i].low;
      const volumeWeight = data[i].volume / (data.reduce((s, c) => s + c.volume, 0) / len);
      const strength = Math.min(1, volumeWeight / 2);
      rawPivots.push({
        index: i,
        price,
        type,
        isConfirmed: i < len - rightBars,
        strength,
        direction: type === 'HIGH' ? 'UP' : 'DOWN'
      });
    }
  }

  // ZigZag Stateful
  const finalPivots: Pivot[] = [];
  for (const p of rawPivots) {
    if (finalPivots.length === 0) {
      finalPivots.push(p);
      continue;
    }
    const last = finalPivots[finalPivots.length - 1];
    if (p.type === last.type) {
      if ((p.type === 'HIGH' && p.price > last.price) || (p.type === 'LOW' && p.price < last.price)) {
        finalPivots[finalPivots.length - 1] = p;
      }
    } else {
      if (Math.abs(p.price - last.price) >= minDeviation) {
        finalPivots.push(p);
      }
    }
  }
  return finalPivots;
}
