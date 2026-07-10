// src/engine/liquidityEngine.ts

import { Candle, Pivot, LiquidityZone, ElliottResult, CVDResult } from './types';

export function detectLiquidityZones(
  candles: Candle[],
  pivots: Pivot[],
  elliott: ElliottResult | null,
  cvd: CVDResult | null,
  lookback: number = 50
): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  const len = candles.length;
  if (len < lookback) return zones;

  const confirmedPivots = pivots.filter(p => p.isConfirmed);
  if (confirmedPivots.length < 2) return zones;

  for (let i = lookback; i < len - 1; i++) {
    const window = candles.slice(i - lookback, i + 1);
    const high = Math.max(...window.map(c => c.high));
    const low = Math.min(...window.map(c => c.low));

    if (candles[i].high === high) {
      let strength = 50;
      let withElliott = false;
      let withCVD = false;

      if (elliott) {
        const ep = elliott.waveEndpoints.find(p => Math.abs(p.index - i) <= 5);
        if (ep) { withElliott = true; strength += 25; }
      }
      if (cvd) {
        const cp = cvd.cvdPivots.find(p => Math.abs(p.index - i) <= 5);
        if (cp && cp.type === 'HIGH') { withCVD = true; strength += 15; }
      }

      const currentPrice = candles[i].close;
      const isBreached = currentPrice > high;

      zones.push({
        index: i,
        type: 'HIGH',
        price: high,
        strength: Math.min(100, strength),
        isConfirmed: i < len - 5,
        confluence: { withElliott, withCVD },
        isBreached,
        breachPrice: isBreached ? currentPrice : undefined,
        breachIndex: isBreached ? i : undefined
      });
    }

    if (candles[i].low === low) {
      let strength = 50;
      let withElliott = false;
      let withCVD = false;

      if (elliott) {
        const ep = elliott.waveEndpoints.find(p => Math.abs(p.index - i) <= 5);
        if (ep) { withElliott = true; strength += 25; }
      }
      if (cvd) {
        const cp = cvd.cvdPivots.find(p => Math.abs(p.index - i) <= 5);
        if (cp && cp.type === 'LOW') { withCVD = true; strength += 15; }
      }

      const currentPrice = candles[i].close;
      const isBreached = currentPrice < low;

      zones.push({
        index: i,
        type: 'LOW',
        price: low,
        strength: Math.min(100, strength),
        isConfirmed: i < len - 5,
        confluence: { withElliott, withCVD },
        isBreached,
        breachPrice: isBreached ? currentPrice : undefined,
        breachIndex: isBreached ? i : undefined
      });
    }
  }
  return zones;
}
