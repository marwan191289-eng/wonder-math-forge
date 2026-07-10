// src/engine/orderBlockEngine.ts

import { Candle, Pivot, OrderBlock, ElliottResult, CVDResult } from './types';
import { calculateATR } from '../utils/math';

function precomputeAvgVolume(candles: Candle[], period: number = 20): number[] {
  const avgs: number[] = new Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - period);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= i; j++) {
      sum += candles[j].volume;
      count++;
    }
    avgs[i] = sum / (count || 1);
  }
  return avgs;
}

export function detectOrderBlocks(
  candles: Candle[],
  pivots: Pivot[],
  elliott: ElliottResult | null,
  cvd: CVDResult | null,
  atr: number
): OrderBlock[] {
  const blocks: OrderBlock[] = [];
  const len = candles.length;
  const avgVolumes = precomputeAvgVolume(candles, 20);
  const globalAvgVolume = candles.reduce((s, c) => s + c.volume, 0) / len;
  const avgPrice = candles[candles.length - 1]?.close || 1;

  const minBreakSize = atr * (0.8 + (atr / avgPrice) * 5);

  if (pivots.length < 2) return [];
  const confirmedPivots = pivots.filter(p => p.isConfirmed);
  if (confirmedPivots.length < 2) return [];

  for (let i = 1; i < len - 1; i++) {
    const pivotsUpToI = confirmedPivots.filter(p => p.index < i);
    if (pivotsUpToI.length < 2) continue;

    const lastHigh = pivotsUpToI.filter(p => p.type === 'HIGH').pop();
    const lastLow = pivotsUpToI.filter(p => p.type === 'LOW').pop();

    const currentCandle = candles[i];
    const prevCandle = candles[i - 1];

    let isBOS = false;
    let bosType: 'BULLISH_BOS' | 'BEARISH_BOS' | null = null;
    let brokenStructure = 0;
    let bosStrength = 0;

    if (lastHigh && currentCandle.high > lastHigh.price && prevCandle.high <= lastHigh.price) {
      const breakSize = currentCandle.high - lastHigh.price;
      if (breakSize >= minBreakSize) {
        isBOS = true;
        bosType = 'BULLISH_BOS';
        brokenStructure = lastHigh.price;
        const volumeSpike = currentCandle.volume > avgVolumes[i] * 1.5;
        bosStrength = Math.min(100, (breakSize / (atr || 1)) * 30 + (volumeSpike ? 30 : 0) + 20);
      }
    } else if (lastLow && currentCandle.low < lastLow.price && prevCandle.low >= lastLow.price) {
      const breakSize = lastLow.price - currentCandle.low;
      if (breakSize >= minBreakSize) {
        isBOS = true;
        bosType = 'BEARISH_BOS';
        brokenStructure = lastLow.price;
        const volumeSpike = currentCandle.volume > avgVolumes[i] * 1.5;
        bosStrength = Math.min(100, (breakSize / (atr || 1)) * 30 + (volumeSpike ? 30 : 0) + 20);
      }
    }

    if (!isBOS) continue;

    const blockStart = Math.max(0, i - 2);
    const blockEnd = i - 1;
    const blockCandles = candles.slice(blockStart, blockEnd + 1);

    const blockHigh = Math.max(...blockCandles.map(c => c.high));
    const blockLow = Math.min(...blockCandles.map(c => c.low));
    const blockAvgVol = blockCandles.reduce((s, c) => s + c.volume, 0) / blockCandles.length;

    const type = bosType === 'BULLISH_BOS' ? 'BEARISH' : 'BULLISH';

    const volumeRatio = blockAvgVol / globalAvgVolume;
    const rangeRatio = (blockHigh - blockLow) / (atr || 1);
    let strength = Math.min(100, (volumeRatio * 25 + rangeRatio * 25 + bosStrength * 0.5));

    let withElliott = false;
    let withCVD = false;
    let elliottWaveNumber: number | undefined = undefined;
    let cvdDivergenceType: 'BULLISH' | 'BEARISH' | undefined = undefined;

    if (elliott) {
      const ep = elliott.waveEndpoints.find(p => Math.abs(p.index - i) <= 5);
      if (ep) {
        withElliott = true;
        elliottWaveNumber = elliott.bestCount?.waves?.length || 0;
        strength += 15;
      }
    }

    if (cvd) {
      const cp = cvd.cvdPivots.find(p => Math.abs(p.index - i) <= 5);
      if (cp && cp.type !== (type === 'BULLISH' ? 'HIGH' : 'LOW')) {
        withCVD = true;
        cvdDivergenceType = type === 'BULLISH' ? 'BULLISH' : 'BEARISH';
        strength += 10;
      }
    }

    const currentPrice = candles[i].close;
    const isPartial = currentPrice >= blockLow && currentPrice <= blockHigh;
    let isFull = false;
    if (type === 'BULLISH' && currentPrice < blockLow) isFull = true;
    if (type === 'BEARISH' && currentPrice > blockHigh) isFull = true;

    blocks.push({
      index: i,
      high: blockHigh,
      low: blockLow,
      type,
      strength: Math.min(100, strength),
      isConfirmed: i < len - 5,
      isMitigated: isFull,
      mitigationPrice: isFull ? currentPrice : undefined,
      mitigationIndex: isFull ? i : undefined,
      isPartiallyMitigated: isPartial,
      partialMitigationPrice: isPartial ? currentPrice : undefined,
      partialMitigationIndex: isPartial ? i : undefined,
      confluence: { withElliott, withCVD, elliottWaveNumber, cvdDivergenceType },
      bosIndex: i,
      bosStrength
    });
  }

  const uniqueBlocks: OrderBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < uniqueBlocks.length; j++) {
      if (Math.abs(blocks[i].index - uniqueBlocks[j].index) <= 3) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) uniqueBlocks.push(blocks[i]);
  }
  return uniqueBlocks;
}
