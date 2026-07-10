// src/engine/bosEngine.ts

import { Candle, Pivot, BreakOfStructure } from './types';
import { calculateATR } from '../utils/math';

export function detectBreakOfStructure(
  candles: Candle[],
  pivots: Pivot[],
  atr: number
): BreakOfStructure[] {
  const bosSignals: BreakOfStructure[] = [];
  if (pivots.length < 2) return bosSignals;

  const confirmedPivots = pivots.filter(p => p.isConfirmed);
  if (confirmedPivots.length < 2) return bosSignals;

  const lastHigh = confirmedPivots.filter(p => p.type === 'HIGH').pop();
  const lastLow = confirmedPivots.filter(p => p.type === 'LOW').pop();

  const currentCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];
  const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / candles.length;
  const avgPrice = candles[candles.length - 1]?.close || 1;

  const minBreakSize = atr * (0.8 + (atr / avgPrice) * 5);

  if (lastHigh && currentCandle.high > lastHigh.price && prevCandle.high <= lastHigh.price) {
    const breakSize = currentCandle.high - lastHigh.price;
    if (breakSize >= minBreakSize) {
      const volumeSpike = currentCandle.volume > avgVolume * 1.5;
      const strength = Math.min(100, (breakSize / (atr || 1)) * 35 + (volumeSpike ? 30 : 0) + 15);
      bosSignals.push({
        index: candles.length - 1,
        type: 'BULLISH_BOS',
        breakLevel: currentCandle.high,
        previousStructure: lastHigh.price,
        strength: Math.round(strength),
        isConfirmed: false,
        volumeSpike
      });
    }
  }

  if (lastLow && currentCandle.low < lastLow.price && prevCandle.low >= lastLow.price) {
    const breakSize = lastLow.price - currentCandle.low;
    if (breakSize >= minBreakSize) {
      const volumeSpike = currentCandle.volume > avgVolume * 1.5;
      const strength = Math.min(100, (breakSize / (atr || 1)) * 35 + (volumeSpike ? 30 : 0) + 15);
      bosSignals.push({
        index: candles.length - 1,
        type: 'BEARISH_BOS',
        breakLevel: currentCandle.low,
        previousStructure: lastLow.price,
        strength: Math.round(strength),
        isConfirmed: false,
        volumeSpike
      });
    }
  }

  return bosSignals;
}
