/**
 * Institutional Scoring Engine V2
 * Multi-layered composite scoring system for crypto market intelligence
 * Score range: -100 (strong bearish) to +100 (strong bullish)
 */

import type { BinanceKline, BinanceOrderBook } from './binance-client';

export interface ScoreComponents {
  bookImbalance: number; // -1 to 1
  wallPressure: number; // -1 to 1
  momentum: number; // -1 to 1
  microDrift: number; // -1 to 1
  rsi: number; // 0 to 100
  cvdSignal: number; // -1 to 1
  ofiSignal: number; // -1 to 1
}

export interface CompositeScore {
  score: number; // -100 to 100
  confidence: number; // 0 to 100
  regime: 'trending' | 'ranging' | 'volatile';
  components: ScoreComponents;
  side: 'long' | 'short' | 'none';
  reasoning: string;
}

/**
 * Calculate book imbalance from order book
 * Positive = more buy pressure, Negative = more sell pressure
 */
export function calculateBookImbalance(book: BinanceOrderBook, depth: number = 10): number {
  if (!book.bids.length || !book.asks.length) return 0;

  let bidVolume = 0;
  let askVolume = 0;

  for (let i = 0; i < Math.min(depth, book.bids.length); i++) {
    bidVolume += parseFloat(book.bids[i][1]);
  }

  for (let i = 0; i < Math.min(depth, book.asks.length); i++) {
    askVolume += parseFloat(book.asks[i][1]);
  }

  const total = bidVolume + askVolume;
  if (total === 0) return 0;

  return (bidVolume - askVolume) / total;
}

/**
 * Calculate wall pressure from order book
 * Identifies large orders (walls) and their proximity to price
 */
export function calculateWallPressure(book: BinanceOrderBook, currentPrice: number): number {
  if (!book.bids.length || !book.asks.length) return 0;

  const bestBid = parseFloat(book.bids[0][0]);
  const bestAsk = parseFloat(book.asks[0][0]);

  // Find largest bid wall
  let maxBidVolume = 0;
  let maxBidDistance = 0;
  for (let i = 0; i < Math.min(20, book.bids.length); i++) {
    const volume = parseFloat(book.bids[i][1]);
    const price = parseFloat(book.bids[i][0]);
    const distance = (bestBid - price) / bestBid;

    if (volume > maxBidVolume && distance < 0.02) {
      maxBidVolume = volume;
      maxBidDistance = distance;
    }
  }

  // Find largest ask wall
  let maxAskVolume = 0;
  let maxAskDistance = 0;
  for (let i = 0; i < Math.min(20, book.asks.length); i++) {
    const volume = parseFloat(book.asks[i][1]);
    const price = parseFloat(book.asks[i][0]);
    const distance = (price - bestAsk) / bestAsk;

    if (volume > maxAskVolume && distance < 0.02) {
      maxAskVolume = volume;
      maxAskDistance = distance;
    }
  }

  // Normalize to -1 to 1
  const totalBidVolume = book.bids.reduce((sum, [_, qty]) => sum + parseFloat(qty), 0);
  const totalAskVolume = book.asks.reduce((sum, [_, qty]) => sum + parseFloat(qty), 0);
  const avgBidVolume = totalBidVolume / Math.min(20, book.bids.length);
  const avgAskVolume = totalAskVolume / Math.min(20, book.asks.length);

  const bidWallStrength = Math.min(1, maxBidVolume / (avgBidVolume * 3));
  const askWallStrength = Math.min(1, maxAskVolume / (avgAskVolume * 3));

  return (bidWallStrength - askWallStrength) * 0.5;
}

/**
 * Calculate momentum from klines
 * Uses rate of change and volume
 */
export function calculateMomentum(klines: BinanceKline[], period: number = 14): number {
  if (klines.length < period) return 0;

  const recent = klines.slice(-period);
  const oldest = parseFloat(recent[0].close);
  const newest = parseFloat(recent[recent.length - 1].close);

  const priceChange = (newest - oldest) / oldest;

  // Volume momentum
  let recentVolume = 0;
  let olderVolume = 0;

  for (let i = 0; i < recent.length / 2; i++) {
    olderVolume += parseFloat(recent[i].volume);
  }
  for (let i = Math.floor(recent.length / 2); i < recent.length; i++) {
    recentVolume += parseFloat(recent[i].volume);
  }

  const volumeMomentum = (recentVolume - olderVolume) / (olderVolume + recentVolume);

  // Combine price and volume momentum
  const combined = (priceChange * 0.7 + volumeMomentum * 0.3);
  return Math.max(-1, Math.min(1, combined));
}

/**
 * Calculate micro-drift (short-term price direction)
 */
export function calculateMicroDrift(klines: BinanceKline[], period: number = 5): number {
  if (klines.length < period) return 0;

  const recent = klines.slice(-period);
  let upCandles = 0;

  for (const k of recent) {
    const open = parseFloat(k.open);
    const close = parseFloat(k.close);
    if (close > open) upCandles++;
  }

  return (upCandles / period) * 2 - 1; // -1 to 1
}

/**
 * Calculate RSI (Relative Strength Index)
 */
export function calculateRSI(klines: BinanceKline[], period: number = 14): number {
  if (klines.length < period + 1) return 50;

  const changes: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const prev = parseFloat(klines[i - 1].close);
    const curr = parseFloat(klines[i].close);
    changes.push(curr - prev);
  }

  const gains = changes.filter(c => c > 0).slice(-period);
  const losses = changes.filter(c => c < 0).slice(-period).map(c => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
}

/**
 * Calculate CVD (Cumulative Volume Delta) signal
 */
export function calculateCVDSignal(klines: BinanceKline[]): number {
  if (klines.length === 0) return 0;

  let cvd = 0;
  for (const k of klines) {
    const buyVolume = parseFloat(k.takerBuyQuoteAssetVolume);
    const totalVolume = parseFloat(k.quoteAssetVolume);
    const sellVolume = totalVolume - buyVolume;

    cvd += buyVolume - sellVolume;
  }

  // Normalize
  const totalVolume = klines.reduce((sum, k) => sum + parseFloat(k.quoteAssetVolume), 0);
  return Math.max(-1, Math.min(1, cvd / totalVolume));
}

/**
 * Calculate OFI (Order Flow Imbalance) signal
 */
export function calculateOFISignal(book: BinanceOrderBook): number {
  if (!book.bids.length || !book.asks.length) return 0;

  let ofi = 0;
  const depth = Math.min(10, book.bids.length, book.asks.length);

  for (let i = 0; i < depth; i++) {
    const bidPrice = parseFloat(book.bids[i][0]);
    const bidQty = parseFloat(book.bids[i][1]);
    const askPrice = parseFloat(book.asks[i][0]);
    const askQty = parseFloat(book.asks[i][1]);

    // Proximity weighting: closer to mid-price = more weight
    const bidWeight = 1 / (i + 1);
    const askWeight = 1 / (i + 1);

    ofi += bidQty * bidPrice * bidWeight;
    ofi -= askQty * askPrice * askWeight;
  }

  // Normalize
  const totalValue = book.bids.reduce((sum, [p, q]) => sum + parseFloat(p) * parseFloat(q), 0) +
                     book.asks.reduce((sum, [p, q]) => sum + parseFloat(p) * parseFloat(q), 0);

  return Math.max(-1, Math.min(1, ofi / totalValue));
}

/**
 * Detect market regime
 */
export function detectRegime(klines: BinanceKline[], period: number = 20): 'trending' | 'ranging' | 'volatile' {
  if (klines.length < period) return 'ranging';

  const recent = klines.slice(-period);
  const closes = recent.map(k => parseFloat(k.close));
  const highs = recent.map(k => parseFloat(k.high));
  const lows = recent.map(k => parseFloat(k.low));

  // Calculate ATR (Average True Range)
  let atrSum = 0;
  for (let i = 1; i < recent.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    atrSum += tr;
  }
  const atr = atrSum / (recent.length - 1);

  // Calculate slope (trend strength)
  const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
  let slope = 0;
  for (let i = 0; i < closes.length; i++) {
    slope += (i - closes.length / 2) * (closes[i] - avgClose);
  }

  const volatility = atr / avgClose;
  const trendStrength = Math.abs(slope) / (closes.length * avgClose);

  if (volatility > 0.03) return 'volatile';
  if (trendStrength > 0.01) return 'trending';
  return 'ranging';
}

/**
 * Calculate composite institutional score
 */
export function calculateCompositeScore(
  book: BinanceOrderBook,
  klines: BinanceKline[],
  currentPrice: number
): CompositeScore {
  // Calculate all components
  const bookImbalance = calculateBookImbalance(book);
  const wallPressure = calculateWallPressure(book, currentPrice);
  const momentum = calculateMomentum(klines);
  const microDrift = calculateMicroDrift(klines);
  const rsi = calculateRSI(klines) / 100 - 0.5; // Normalize to -0.5 to 0.5
  const cvdSignal = calculateCVDSignal(klines);
  const ofiSignal = calculateOFISignal(book);

  const components: ScoreComponents = {
    bookImbalance,
    wallPressure,
    momentum,
    microDrift,
    rsi,
    cvdSignal,
    ofiSignal,
  };

  // Weighted composite score
  const weights = {
    bookImbalance: 0.15,
    wallPressure: 0.15,
    momentum: 0.20,
    microDrift: 0.10,
    rsi: 0.15,
    cvdSignal: 0.15,
    ofiSignal: 0.10,
  };

  let score = 0;
  score += bookImbalance * weights.bookImbalance * 100;
  score += wallPressure * weights.wallPressure * 100;
  score += momentum * weights.momentum * 100;
  score += microDrift * weights.microDrift * 100;
  score += rsi * weights.rsi * 100;
  score += cvdSignal * weights.cvdSignal * 100;
  score += ofiSignal * weights.ofiSignal * 100;

  // Clamp to -100 to 100
  score = Math.max(-100, Math.min(100, score));

  // Calculate confidence based on component agreement
  const componentValues = Object.values(components);
  const avgComponent = componentValues.reduce((a, b) => a + b, 0) / componentValues.length;
  const variance = componentValues.reduce((sum, v) => sum + Math.pow(v - avgComponent, 2), 0) / componentValues.length;
  const confidence = Math.max(0, Math.min(100, 100 - variance * 100));

  // Determine side
  let side: 'long' | 'short' | 'none' = 'none';
  if (score > 30) side = 'long';
  if (score < -30) side = 'short';

  // Detect regime
  const regime = detectRegime(klines);

  // Generate reasoning
  const reasoning = generateReasoning(score, components, regime);

  return {
    score,
    confidence,
    regime,
    components,
    side,
    reasoning,
  };
}

/**
 * Generate human-readable reasoning for the score
 */
function generateReasoning(score: number, components: ScoreComponents, regime: string): string {
  const topComponent = Object.entries(components).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
  const [componentName, componentValue] = topComponent;

  if (score > 50) {
    return `Strong bullish signal driven by ${componentName} (${(componentValue * 100).toFixed(1)}). Market in ${regime} regime.`;
  } else if (score > 30) {
    return `Bullish bias with moderate strength. ${componentName} showing positive pressure. ${regime} market.`;
  } else if (score > 0) {
    return `Slight bullish lean. Mixed signals across components. ${regime} regime.`;
  } else if (score > -30) {
    return `Slight bearish lean. Mixed signals across components. ${regime} regime.`;
  } else if (score > -50) {
    return `Bearish bias with moderate strength. ${componentName} showing negative pressure. ${regime} market.`;
  } else {
    return `Strong bearish signal driven by ${componentName} (${(componentValue * 100).toFixed(1)}). Market in ${regime} regime.`;
  }
}


