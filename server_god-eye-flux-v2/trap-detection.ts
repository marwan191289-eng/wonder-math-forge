import { Candle } from './advanced-volume-analysis';

export interface TrapDetectionResult {
  timestamp: number;
  type: 'STOP_HUNT' | 'LIQUIDITY_TRAP' | 'WHALE_TRAP';
  message: string;
  confidence: number;
  price: number;
}

/**
 * Detects stop hunts by identifying rapid price movements beyond recent highs/lows
 * followed by a reversal.
 */
export function detectStopHunt(candles: Candle[], lookbackPeriod: number = 10): TrapDetectionResult[] {
  const traps: TrapDetectionResult[] = [];
  if (candles.length < lookbackPeriod + 2) return traps;

  for (let i = lookbackPeriod; i < candles.length - 1; i++) {
    const currentCandle = candles[i];
    const nextCandle = candles[i + 1];
    const lookbackHighs = candles.slice(i - lookbackPeriod, i).map(c => c.high);
    const lookbackLows = candles.slice(i - lookbackPeriod, i).map(c => c.low);

    const previousHigh = Math.max(...lookbackHighs);
    const previousLow = Math.min(...lookbackLows);

    // Stop hunt above previous high
    if (currentCandle.high > previousHigh && nextCandle.close < previousHigh) {
      traps.push({
        timestamp: currentCandle.timestamp,
        type: 'STOP_HUNT',
        message: `Potential stop hunt above ${previousHigh.toFixed(2)}`,
        confidence: 0.7,
        price: currentCandle.high,
      });
    }

    // Stop hunt below previous low
    if (currentCandle.low < previousLow && nextCandle.close > previousLow) {
      traps.push({
        timestamp: currentCandle.timestamp,
        type: 'STOP_HUNT',
        message: `Potential stop hunt below ${previousLow.toFixed(2)}`,
        confidence: 0.7,
        price: currentCandle.low,
      });
    }
  }
  return traps;
}

/**
 * Detects liquidity traps by identifying false breakouts where price moves beyond
 * a key level but fails to sustain and reverses quickly.
 */
export function detectLiquidityTrap(candles: Candle[], keyLevels: number[], lookbackPeriod: number = 20): TrapDetectionResult[] {
  const traps: TrapDetectionResult[] = [];
  if (candles.length < lookbackPeriod + 2) return traps;

  for (let i = lookbackPeriod; i < candles.length - 1; i++) {
    const currentCandle = candles[i];
    const nextCandle = candles[i + 1];

    for (const level of keyLevels) {
      // Price breaks above level but closes below it, and next candle confirms reversal
      if (currentCandle.high > level && currentCandle.close < level && nextCandle.close < level) {
        traps.push({
          timestamp: currentCandle.timestamp,
          type: 'LIQUIDITY_TRAP',
          message: `Liquidity trap above ${level.toFixed(2)}`,
          confidence: 0.8,
          price: currentCandle.high,
        });
      }
      // Price breaks below level but closes above it, and next candle confirms reversal
      if (currentCandle.low < level && currentCandle.close > level && nextCandle.close > level) {
        traps.push({
          timestamp: currentCandle.timestamp,
          type: 'LIQUIDITY_TRAP',
          message: `Liquidity trap below ${level.toFixed(2)}`,
          confidence: 0.8,
          price: currentCandle.low,
        });
      }
    }
  }
  return traps;
}

/**
 * Detects whale traps by identifying large volume spikes that fail to move price
 * significantly, indicating absorption or manipulation.
 */
export function detectWhaleTrap(candles: Candle[], volumeMultiplier: number = 2, lookbackPeriod: number = 20): TrapDetectionResult[] {
  const traps: TrapDetectionResult[] = [];
  if (candles.length < lookbackPeriod + 1) return traps;

  const averageVolume = candles.slice(0, lookbackPeriod).map(c => c.volume).reduce((a, b) => a + b, 0) / lookbackPeriod;

  for (let i = lookbackPeriod; i < candles.length; i++) {
    const currentCandle = candles[i];

    if (currentCandle.volume > averageVolume * volumeMultiplier) {
      const priceChange = Math.abs(currentCandle.close - currentCandle.open);
      const relativePriceChange = priceChange / ((currentCandle.high + currentCandle.low) / 2 || 1);

      // If high volume but small price change, it might be a whale trap
      if (relativePriceChange < 0.005) { // Less than 0.5% price change
        traps.push({
          timestamp: currentCandle.timestamp,
          type: 'WHALE_TRAP',
          message: `Potential whale trap at ${currentCandle.close.toFixed(2)} with high volume`,
          confidence: 0.9,
          price: currentCandle.close,
        });
      }
    }
  }
  return traps;
}

export default {
  detectStopHunt,
  detectLiquidityTrap,
  detectWhaleTrap,
};
