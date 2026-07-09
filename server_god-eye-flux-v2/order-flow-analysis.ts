/**
 * Advanced Order Flow & Volume Profile Analysis Engine
 * 
 * Implements institutional-grade microstructure analysis:
 * - Cumulative Delta (CD) for order flow direction
 * - Volume-Weighted Average Price (VWAP)
 * - Volume Profile with POC (Point of Control)
 * - Institutional Order Detection
 * - Order Flow Toxicity
 */

export interface OrderFlowMetrics {
  cumulativeDelta: number; // -1 to 1, negative = selling pressure, positive = buying pressure
  deltaRatio: number; // Buy volume / Total volume
  vwap: number;
  volumeProfile: VolumeProfile;
  institutionalActivity: number; // 0-100
  orderFlowToxicity: number; // 0-100, higher = more toxic (institutional selling)
  buyPressure: number; // 0-100
  sellPressure: number; // 0-100
  imbalanceRatio: number; // Bid volume / Ask volume
  reasoning: string;
}

export interface VolumeProfile {
  pointOfControl: number; // Price level with highest volume
  valueArea: { high: number; low: number }; // 70% of volume range
  profileBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; // Based on POC position
  volumeDistribution: Array<{ price: number; volume: number }>;
}

/**
 * Calculate Cumulative Delta
 * Tracks the cumulative difference between buy and sell volume
 */
export function calculateCumulativeDelta(
  klines: Array<{
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>
): number {
  if (klines.length === 0) return 0;

  let cumulativeDelta = 0;

  for (const kline of klines) {
    const close = typeof kline.close === 'string' ? parseFloat(kline.close) : kline.close;
    const open = typeof kline.open === 'string' ? parseFloat(kline.open) : kline.open;
    const volume = typeof kline.volume === 'string' ? parseFloat(kline.volume) : kline.volume;

    // Estimate buy/sell volume based on close vs open
    // If close > open: bullish candle, assume more buy volume
    // If close < open: bearish candle, assume more sell volume
    const direction = close > open ? 1 : close < open ? -1 : 0;
    const delta = volume * direction;

    cumulativeDelta += delta;
  }

  // Normalize to -1 to 1 range
  const totalVolume = klines.reduce((sum, k) => {
    const vol = typeof k.volume === 'string' ? parseFloat(k.volume) : k.volume;
    return sum + vol;
  }, 0);

  if (totalVolume === 0) return 0;
  return Math.max(-1, Math.min(1, cumulativeDelta / totalVolume));
}

/**
 * Calculate Volume-Weighted Average Price (VWAP)
 * Critical for identifying institutional entry/exit levels
 */
export function calculateVWAP(
  klines: Array<{
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>
): number {
  if (klines.length === 0) return 0;

  let typicalPriceVolume = 0;
  let totalVolume = 0;

  for (const kline of klines) {
    const high = typeof kline.high === 'string' ? parseFloat(kline.high) : kline.high;
    const low = typeof kline.low === 'string' ? parseFloat(kline.low) : kline.low;
    const close = typeof kline.close === 'string' ? parseFloat(kline.close) : kline.close;
    const volume = typeof kline.volume === 'string' ? parseFloat(kline.volume) : kline.volume;

    // Typical price = (High + Low + Close) / 3
    const typicalPrice = (high + low + close) / 3;
    typicalPriceVolume += typicalPrice * volume;
    totalVolume += volume;
  }

  if (totalVolume === 0) return 0;
  return typicalPriceVolume / totalVolume;
}

/**
 * Calculate Volume Profile
 * Identifies price levels with highest trading activity (Point of Control)
 */
export function calculateVolumeProfile(
  klines: Array<{
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>,
  buckets: number = 20
): VolumeProfile {
  if (klines.length === 0) {
    return {
      pointOfControl: 0,
      valueArea: { high: 0, low: 0 },
      profileBias: 'NEUTRAL',
      volumeDistribution: [],
    };
  }

  // Find price range
  const prices = klines.flatMap(k => {
    const high = typeof k.high === 'string' ? parseFloat(k.high) : k.high;
    const low = typeof k.low === 'string' ? parseFloat(k.low) : k.low;
    return [high, low];
  });

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const bucketSize = priceRange / buckets;

  // Initialize volume buckets
  const volumeBuckets: Map<number, number> = new Map();
  for (let i = 0; i < buckets; i++) {
    const bucketPrice = minPrice + bucketSize * i;
    volumeBuckets.set(bucketPrice, 0);
  }

  // Distribute volume across price levels
  for (const kline of klines) {
    const high = typeof kline.high === 'string' ? parseFloat(kline.high) : kline.high;
    const low = typeof kline.low === 'string' ? parseFloat(kline.low) : kline.low;
    const volume = typeof kline.volume === 'string' ? parseFloat(kline.volume) : kline.volume;

    // Distribute volume across the price range of the candle
    for (let i = 0; i < buckets; i++) {
      const bucketPrice = minPrice + bucketSize * i;
      if (bucketPrice >= low && bucketPrice <= high) {
        volumeBuckets.set(bucketPrice, (volumeBuckets.get(bucketPrice) || 0) + volume / buckets);
      }
    }
  }

  // Find Point of Control (highest volume price)
  let pointOfControl = minPrice;
  let maxVolume = 0;
  for (const [price, volume] of volumeBuckets) {
    if (volume > maxVolume) {
      maxVolume = volume;
      pointOfControl = price;
    }
  }

  // Calculate Value Area (70% of total volume)
  const totalVolume = Array.from(volumeBuckets.values()).reduce((a, b) => a + b, 0);
  const valueAreaTarget = totalVolume * 0.7;
  let valueAreaVolume = 0;
  let valueAreaHigh = pointOfControl;
  let valueAreaLow = pointOfControl;

  // Expand from POC until we reach 70% of volume
  const sortedBuckets = Array.from(volumeBuckets.entries())
    .sort((a, b) => Math.abs(b[0] - pointOfControl) - Math.abs(a[0] - pointOfControl));

  for (const [price, volume] of sortedBuckets) {
    valueAreaVolume += volume;
    valueAreaHigh = Math.max(valueAreaHigh, price);
    valueAreaLow = Math.min(valueAreaLow, price);

    if (valueAreaVolume >= valueAreaTarget) break;
  }

  // Determine profile bias
  const currentPrice = typeof klines[klines.length - 1].close === 'string'
    ? parseFloat(klines[klines.length - 1].close as string)
    : klines[klines.length - 1].close as number;

  let profileBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (pointOfControl < currentPrice - priceRange * 0.1) {
    profileBias = 'BULLISH'; // POC below current price = bullish
  } else if (pointOfControl > currentPrice + priceRange * 0.1) {
    profileBias = 'BEARISH'; // POC above current price = bearish
  }

  // Build volume distribution array
  const volumeDistribution = Array.from(volumeBuckets.entries())
    .map(([price, volume]) => ({ price, volume }))
    .sort((a, b) => a.price - b.price);

  return {
    pointOfControl,
    valueArea: { high: valueAreaHigh, low: valueAreaLow },
    profileBias,
    volumeDistribution,
  };
}

/**
 * Detect Institutional Order Flow
 * Identifies large orders and unusual volume patterns
 */
export function detectInstitutionalActivity(
  orderBook: any,
  klines: Array<{ volume: string | number }>,
  currentPrice: number
): number {
  if (!orderBook || !orderBook.bids || !orderBook.asks) return 0;

  // Calculate average volume
  const avgVolume = klines.reduce((sum, k) => {
    const vol = typeof k.volume === 'string' ? parseFloat(k.volume) : k.volume;
    return sum + vol;
  }, 0) / klines.length;

  // Check for large orders in order book
  let largeOrderCount = 0;
  const largeOrderThreshold = avgVolume * 0.1; // Orders > 10% of avg volume

  for (const [_price, qty] of orderBook.bids) {
    const quantity = parseFloat(qty);
    if (quantity > largeOrderThreshold) largeOrderCount++;
  }

  for (const [_price, qty] of orderBook.asks) {
    const quantity = parseFloat(qty);
    if (quantity > largeOrderThreshold) largeOrderCount++;
  }

  // Normalize to 0-100
  return Math.min(100, (largeOrderCount / 10) * 100);
}

/**
 * Calculate Order Flow Toxicity
 * Measures the likelihood of informed trading (institutional selling/buying)
 */
export function calculateOrderFlowToxicity(
  cumulativeDelta: number,
  institutionalActivity: number,
  volumeProfile: VolumeProfile,
  currentPrice: number
): number {
  let toxicity = 0;

  // Factor 1: Negative delta = selling pressure (toxic for longs)
  if (cumulativeDelta < 0) {
    toxicity += Math.abs(cumulativeDelta) * 30; // Up to 30 points
  }

  // Factor 2: Institutional activity
  toxicity += institutionalActivity * 0.3; // Up to 30 points

  // Factor 3: POC position (if POC is above current price, selling pressure)
  if (volumeProfile.pointOfControl > currentPrice) {
    const pocDistance = (volumeProfile.pointOfControl - currentPrice) / currentPrice;
    toxicity += Math.min(40, pocDistance * 100); // Up to 40 points
  }

  return Math.min(100, toxicity);
}

/**
 * Calculate Bid-Ask Imbalance
 * Measures the ratio of buy pressure to sell pressure
 */
export function calculateImbalanceRatio(orderBook: any): number {
  if (!orderBook || !orderBook.bids || !orderBook.asks) return 1;

  const bidVolume = orderBook.bids
    .slice(0, 5)
    .reduce((sum: number, [_price, qty]: [string, string]) => sum + parseFloat(qty), 0);

  const askVolume = orderBook.asks
    .slice(0, 5)
    .reduce((sum: number, [_price, qty]: [string, string]) => sum + parseFloat(qty), 0);

  if (askVolume === 0) return 100;
  return (bidVolume / askVolume) * 100;
}

/**
 * Comprehensive Order Flow Analysis
 */
export function analyzeOrderFlow(
  klines: Array<{
    open: string | number;
    high: string | number;
    low: string | number;
    close: string | number;
    volume: string | number;
  }>,
  orderBook: any,
  currentPrice: number
): OrderFlowMetrics {
  const cumulativeDelta = calculateCumulativeDelta(klines);
  const vwap = calculateVWAP(klines);
  const volumeProfile = calculateVolumeProfile(klines);
  const institutionalActivity = detectInstitutionalActivity(orderBook, klines, currentPrice);
  const orderFlowToxicity = calculateOrderFlowToxicity(
    cumulativeDelta,
    institutionalActivity,
    volumeProfile,
    currentPrice
  );

  const totalVolume = klines.reduce((sum, k) => {
    const vol = typeof k.volume === 'string' ? parseFloat(k.volume) : k.volume;
    return sum + vol;
  }, 0);

  const buyVolume = klines.reduce((sum, k) => {
    const close = typeof k.close === 'string' ? parseFloat(k.close) : k.close;
    const open = typeof k.open === 'string' ? parseFloat(k.open) : k.open;
    const vol = typeof k.volume === 'string' ? parseFloat(k.volume) : k.volume;
    return sum + (close > open ? vol : 0);
  }, 0);

  const deltaRatio = totalVolume > 0 ? buyVolume / totalVolume : 0.5;
  const imbalanceRatio = calculateImbalanceRatio(orderBook);

  const buyPressure = deltaRatio * 100;
  const sellPressure = (1 - deltaRatio) * 100;

  let reasoning = '';
  if (cumulativeDelta > 0.5) {
    reasoning = 'Strong buying pressure detected. Institutional buyers accumulating.';
  } else if (cumulativeDelta < -0.5) {
    reasoning = 'Strong selling pressure detected. Institutional distribution phase.';
  } else if (institutionalActivity > 70) {
    reasoning = 'High institutional activity. Large orders detected in order book.';
  } else if (volumeProfile.profileBias === 'BULLISH') {
    reasoning = 'Volume profile shows bullish bias. POC below current price.';
  } else if (volumeProfile.profileBias === 'BEARISH') {
    reasoning = 'Volume profile shows bearish bias. POC above current price.';
  } else {
    reasoning = 'Balanced order flow. No strong directional bias.';
  }

  return {
    cumulativeDelta,
    deltaRatio,
    vwap,
    volumeProfile,
    institutionalActivity,
    orderFlowToxicity,
    buyPressure,
    sellPressure,
    imbalanceRatio,
    reasoning,
  };
}
