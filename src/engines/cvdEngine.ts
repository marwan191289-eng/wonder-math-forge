// src/engine/cvdEngine.ts

import { Candle, Pivot, CVDResult, AnalysisContext } from './types';
import { calculateATR, calculateSmaSlope } from '../utils/math';

function estimateDelta(candle: Candle): number {
  if (candle.takerBuyVolume !== undefined && candle.volume > 0) {
    return candle.takerBuyVolume - (candle.volume - candle.takerBuyVolume);
  }
  const range = candle.high - candle.low || 1e-10;
  const clv = ((candle.close - candle.low) - (candle.high - candle.close)) / range;
  return candle.volume * clv;
}

function calculateCVD(candles: Candle[], smoothingPeriod: number = 5): number[] {
  const rawDeltas = candles.map(estimateDelta);
  const smoothed: number[] = [];
  let cumulative = 0;
  let ema = 0;
  for (let i = 0; i < rawDeltas.length; i++) {
    cumulative += rawDeltas[i];
    const k = 2 / (smoothingPeriod + 1);
    ema = (i === 0) ? cumulative : (cumulative * k + ema * (1 - k));
    smoothed.push(ema);
  }
  return smoothed;
}

function getCvdPivots(cvdLine: number[], leftBars: number = 5, rightBars: number = 5, volatility: number = 0.01): Pivot[] {
  const pivots: Pivot[] = [];
  const len = cvdLine.length;
  if (len < leftBars + rightBars + 1) return pivots;
  const cvdRange = Math.max(...cvdLine) - Math.min(...cvdLine);
  const minChange = Math.max(cvdRange * volatility, 1e-6);
  for (let i = leftBars; i < len - rightBars; i++) {
    const leftSlice = cvdLine.slice(i - leftBars, i);
    const rightSlice = cvdLine.slice(i + 1, i + rightBars + 1);
    const isHigh = cvdLine[i] > Math.max(...leftSlice) && cvdLine[i] > Math.max(...rightSlice) && (cvdLine[i] - Math.max(...leftSlice) > minChange);
    const isLow = cvdLine[i] < Math.min(...leftSlice) && cvdLine[i] < Math.min(...rightSlice) && (Math.min(...leftSlice) - cvdLine[i] > minChange);
    if (isHigh) {
      pivots.push({ index: i, price: cvdLine[i], type: 'HIGH', isConfirmed: i < len - rightBars, strength: 1 });
    }
    if (isLow) {
      pivots.push({ index: i, price: cvdLine[i], type: 'LOW', isConfirmed: i < len - rightBars, strength: 1 });
    }
  }
  return pivots;
}

function divergenceStrength(current: number, previous: number, timeDelta: number): number {
  const changeRel = Math.abs(current - previous) / (Math.abs(previous) + 1e-6);
  const timeDecay = Math.exp(-timeDelta / 10);
  return Math.min(1, changeRel * timeDecay * 1.5);
}

export function analyzeCVD(candles: Candle[], ctx: AnalysisContext): CVDResult {
  const cvdLine = calculateCVD(candles, 5);
  const atr = calculateATR(candles, 14);
  const avgPrice = candles[candles.length - 1]?.close || 1;
  const volatility = 0.01 + (atr / avgPrice) * 0.5;
  const cvdPivots = getCvdPivots(cvdLine, 5, 5, volatility);
  const trendSlope = calculateSmaSlope(cvdLine, 20);

  let totalStrength = 0;
  const penalties: string[] = [];
  if (cvdPivots.length < 2) penalties.push('Insufficient CVD pivots');

  for (let i = 1; i < cvdPivots.length; i++) {
    const prev = cvdPivots[i-1];
    const curr = cvdPivots[i];
    totalStrength += divergenceStrength(curr.price, prev.price, curr.index - prev.index);
  }
  const avgStrength = cvdPivots.length > 1 ? totalStrength / (cvdPivots.length - 1) : 0;

  return {
    cvdPivots,
    strength: Math.min(100, avgStrength * 100),
    trendSlope,
    searchTruncated: ctx.isExpired(),
    penalties
  };
}
