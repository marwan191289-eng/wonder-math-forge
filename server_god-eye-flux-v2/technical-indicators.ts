/**
 * Technical Indicator Calculators
 * 
 * Provides core technical analysis calculations:
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence)
 * - Bollinger Bands
 * - Volatility (Standard Deviation)
 * - Order Flow
 * - Volume Profile
 */

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

/**
 * Calculate RSI (Relative Strength Index)
 * @param prices Array of closing prices
 * @param period Period for RSI calculation (default 14)
 * @returns RSI value (0-100)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50; // Default neutral

  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;

  if (losses === 0) return 100;
  if (gains === 0) return 0;

  const rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * @param prices Array of closing prices
 * @returns MACD value
 */
export function calculateMACD(prices: number[], fast: number = 12, slow: number = 26): number {
  if (prices.length < slow) return 0;

  const fastEMA = calculateEMA(prices, fast);
  const slowEMA = calculateEMA(prices, slow);

  return fastEMA - slowEMA;
}

/**
 * Calculate Exponential Moving Average
 * @param prices Array of prices
 * @param period Period for EMA
 * @returns EMA value
 */
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }

  return ema;
}

/**
 * Calculate Bollinger Bands
 * @param prices Array of closing prices
 * @param period Period for moving average (default 20)
 * @param stdDev Number of standard deviations (default 2)
 * @returns Bollinger Bands with upper, middle, lower
 */
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBands {
  if (prices.length < period) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return { upper: avg, middle: avg, lower: avg };
  }

  const recentPrices = prices.slice(-period);
  const middle = recentPrices.reduce((a, b) => a + b, 0) / period;

  const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period;
  const std = Math.sqrt(variance);

  return {
    upper: middle + stdDev * std,
    middle,
    lower: middle - stdDev * std,
  };
}

/**
 * Calculate Volatility (Standard Deviation of returns)
 * @param prices Array of closing prices
 * @param period Period for volatility calculation (default 20)
 * @returns Volatility as percentage
 */
export function calculateVolatility(prices: number[], period: number = 20): number {
  if (prices.length < period + 1) return 0;

  const recentPrices = prices.slice(-period - 1);
  const returns = recentPrices.slice(1).map((p, i) => (p - recentPrices[i]) / recentPrices[i]);

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);

  return std * 100; // Convert to percentage
}

/**
 * Calculate Order Flow Imbalance
 * @param orderBook Order book with bids and asks
 * @returns Order flow imbalance (-1 to 1, negative = bearish, positive = bullish)
 */
export function calculateOrderFlow(orderBook: any): number {
  if (!orderBook || !orderBook.bids || !orderBook.asks) return 0;

  const bidVolume = orderBook.bids
    .slice(0, 10)
    .reduce((sum: number, [_price, qty]: [string, string]) => sum + parseFloat(qty), 0);

  const askVolume = orderBook.asks
    .slice(0, 10)
    .reduce((sum: number, [_price, qty]: [string, string]) => sum + parseFloat(qty), 0);

  const total = bidVolume + askVolume;
  if (total === 0) return 0;

  return (bidVolume - askVolume) / total;
}

/**
 * Calculate Volume Profile
 * @param volumes Array of volumes
 * @returns Volume profile strength (0-1)
 */
export function calculateVolumeProfile(volumes: number[]): number {
  if (volumes.length === 0) return 0;

  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

  if (avgVolume === 0) return 0;

  // Normalize to 0-1 range
  const ratio = recentVolume / avgVolume;
  return Math.min(1, Math.max(0, (ratio - 0.5) / 2 + 0.5));
}

/**
 * Calculate Simple Moving Average
 * @param prices Array of prices
 * @param period Period for SMA
 * @returns SMA value
 */
export function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const recentPrices = prices.slice(-period);
  return recentPrices.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculate Average True Range (ATR)
 * @param klines Array of klines with high, low, close
 * @param period Period for ATR (default 14)
 * @returns ATR value
 */
export function calculateATR(
  klines: Array<{ high: string | number; low: string | number; close: string | number }>,
  period: number = 14
): number {
  if (klines.length < period) return 0;

  const trueRanges = klines.map((k, i) => {
    const high = typeof k.high === 'string' ? parseFloat(k.high) : k.high;
    const low = typeof k.low === 'string' ? parseFloat(k.low) : k.low;
    const close = i > 0 ? (typeof klines[i - 1].close === 'string' ? parseFloat(klines[i - 1].close as string) : klines[i - 1].close as number) : high;

    return Math.max(
      high - low,
      Math.abs(high - close),
      Math.abs(low - close)
    );
  });

  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / period;
}

/**
 * Calculate Stochastic Oscillator
 * @param klines Array of klines
 * @param period Period for stochastic (default 14)
 * @returns Stochastic K value (0-100)
 */
export function calculateStochastic(
  klines: Array<{ high: string | number; low: string | number; close: string | number }>,
  period: number = 14
): number {
  if (klines.length < period) return 50;

  const recentKlines = klines.slice(-period);
  const highs = recentKlines.map(k => typeof k.high === 'string' ? parseFloat(k.high) : k.high);
  const lows = recentKlines.map(k => typeof k.low === 'string' ? parseFloat(k.low) : k.low);
  const close = typeof klines[klines.length - 1].close === 'string'
    ? parseFloat(klines[klines.length - 1].close as string)
    : klines[klines.length - 1].close as number;

  const highest = Math.max(...highs);
  const lowest = Math.min(...lows);

  if (highest === lowest) return 50;

  return ((close - lowest) / (highest - lowest)) * 100;
}

/**
 * Calculate Rate of Change (ROC)
 * @param prices Array of prices
 * @param period Period for ROC (default 12)
 * @returns ROC value as percentage
 */
export function calculateROC(prices: number[], period: number = 12): number {
  if (prices.length < period + 1) return 0;

  const currentPrice = prices[prices.length - 1];
  const previousPrice = prices[prices.length - period - 1];

  if (previousPrice === 0) return 0;

  return ((currentPrice - previousPrice) / previousPrice) * 100;
}
