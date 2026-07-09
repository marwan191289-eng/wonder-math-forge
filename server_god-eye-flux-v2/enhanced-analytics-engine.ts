import { z } from 'zod';
import { calculateCVD, calculateVolumeProfile, calculateMarketProfile, Candle, VolumeProfile, MarketProfile, CumulativeVolumeDelta } from './advanced-volume-analysis';
import { detectStopHunt, detectLiquidityTrap, detectWhaleTrap, TrapDetectionResult } from './trap-detection';

/**
 * Enhanced Analytics Engine
 * Combines TradeXray's 12-Factor Analysis with FLUX's institutional intelligence
 * Provides comprehensive market analysis with AI briefings and confidence scoring
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TechnicalIndicators {
  rsi: number; // Relative Strength Index (0-100)
  stochastic: { k: number; d: number }; // Stochastic Oscillator
  macd: { macd: number; signal: number; histogram: number }; // MACD
  ema: { ema9: number; ema21: number; ema50: number }; // Exponential Moving Averages
  adx: number; // Average Directional Index (trend strength)
  ichimoku: { tenkan: number; kijun: number; cloudTop: number; cloudBottom: number }; // Ichimoku Cloud
  vwap: number; // Volume Weighted Average Price
  obv: number; // On-Balance Volume
}

export interface Signal {
  symbol: string;
  timestamp: number;
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  confidence: number; // 0-100
  indicators: TechnicalIndicators;
  entry: number;
  target: number;
  stop: number;
  riskRewardRatio: number;
  briefing: string;
}

export interface FearGreedIndex {
  value: number; // 0-100
  classification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  recommendation: string;
}

export interface EnhancedAnalysis {
  symbol: string;
  timestamp: number;
  signal: Signal;
  fearGreedIndex: FearGreedIndex;
  marketPulse: {
    averageConfidence: number;
    bullishCount: number;
    bearishCount: number;
    dominantTrend: 'BULL' | 'BEAR' | 'NEUTRAL';
  };
  aiBriefing: string;
  cvd: CumulativeVolumeDelta[];
  volumeProfile: VolumeProfile;
  marketProfile: MarketProfile;
  trapDetections: TrapDetectionResult[];
}

// ============================================================================
// TECHNICAL INDICATOR CALCULATIONS
// ============================================================================

/**
 * Calculate Relative Strength Index (RSI)
 * Measures momentum and overbought/oversold conditions
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;
  const rs = avgGain / (avgLoss || 1);
  const rsi = 100 - 100 / (1 + rs);

  return Math.min(100, Math.max(0, rsi));
}

/**
 * Calculate Stochastic Oscillator
 * Compares price to price range over time
 */
export function calculateStochastic(
  prices: number[],
  period: number = 14,
  smoothK: number = 3,
  smoothD: number = 3
): { k: number; d: number } {
  if (prices.length < period) return { k: 50, d: 50 };

  const recentPrices = prices.slice(-period);
  const highestHigh = Math.max(...recentPrices);
  const lowestLow = Math.min(...recentPrices);
  const currentPrice = prices[prices.length - 1];

  const k = ((currentPrice - lowestLow) / (highestHigh - lowestLow)) * 100 || 50;
  const d = k; // Simplified: should use SMA

  return {
    k: Math.min(100, Math.max(0, k)),
    d: Math.min(100, Math.max(0, d)),
  };
}

/**
 * Calculate MACD (Moving Average Convergence Divergence)
 * Trend-following momentum indicator
 */
export function calculateMACD(
  prices: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number; signal: number; histogram: number } {
  if (prices.length < slowPeriod) {
    return { macd: 0, signal: 0, histogram: 0 };
  }

  // Simplified: use last prices as EMA approximation
  const fastEMA = prices.slice(-fastPeriod).reduce((a, b) => a + b) / fastPeriod;
  const slowEMA = prices.slice(-slowPeriod).reduce((a, b) => a + b) / slowPeriod;
  const macd = fastEMA - slowEMA;
  const signal = macd; // Simplified: should use SMA of MACD
  const histogram = macd - signal;

  return { macd, signal, histogram };
}

/**
 * Calculate Exponential Moving Averages (EMA)
 * Weighted average giving more importance to recent prices
 */
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;

  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * multiplier + ema * (1 - multiplier);
  }

  return ema;
}

/**
 * Calculate Average Directional Index (ADX)
 * Measures trend strength (0-100, higher = stronger trend)
 */
export function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number {
  if (highs.length < period) return 25;

  let plusDM = 0;
  let minusDM = 0;
  let tr = 0; // True Range

  for (let i = highs.length - period; i < highs.length; i++) {
    const high = highs[i] - highs[i - 1];
    const low = lows[i - 1] - lows[i];

    if (high > low && high > 0) plusDM += high;
    if (low > high && low > 0) minusDM += low;

    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    tr += Math.max(tr1, tr2, tr3);
  }

  const plusDI = (plusDM / tr) * 100;
  const minusDI = (minusDM / tr) * 100;
  const adx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

  return Math.min(100, Math.max(0, adx));
}

/**
 * Calculate VWAP (Volume Weighted Average Price)
 * Average price weighted by volume
 */
export function calculateVWAP(prices: number[], volumes: number[]): number {
  if (prices.length === 0) return 0;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < prices.length; i++) {
    numerator += prices[i] * volumes[i];
    denominator += volumes[i];
  }

  return denominator === 0 ? prices[prices.length - 1] : numerator / denominator;
}

/**
 * Calculate OBV (On-Balance Volume)
 * Momentum indicator using volume
 */
export function calculateOBV(prices: number[], volumes: number[]): number {
  if (prices.length === 0) return 0;

  let obv = volumes[0];

  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > prices[i - 1]) {
      obv += volumes[i];
    } else if (prices[i] < prices[i - 1]) {
      obv -= volumes[i];
    }
  }

  return obv;
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

/**
 * Generate trading signal based on 12-factor analysis
 * Combines all technical indicators for comprehensive analysis
 */
export function generateSignal(
  symbol: string,
  prices: number[],
  volumes: number[],
  highs: number[],
  lows: number[],
  currentPrice: number
): Signal {
  const indicators: TechnicalIndicators = {
    rsi: calculateRSI(prices),
    stochastic: calculateStochastic(prices),
    macd: calculateMACD(prices),
    ema: {
      ema9: calculateEMA(prices, 9),
      ema21: calculateEMA(prices, 21),
      ema50: calculateEMA(prices, 50),
    },
    adx: calculateADX(highs, lows, prices),
    ichimoku: {
      tenkan: (Math.max(...highs.slice(-9)) + Math.min(...lows.slice(-9))) / 2,
      kijun: (Math.max(...highs.slice(-26)) + Math.min(...lows.slice(-26))) / 2,
      cloudTop: 0, // Simplified
      cloudBottom: 0, // Simplified
    },
    vwap: calculateVWAP(prices, volumes),
    obv: calculateOBV(prices, volumes),
  };

  // Determine signal direction and strength
  let bullishScore = 0;
  let bearishScore = 0;

  // RSI analysis
  if (indicators.rsi > 70) bearishScore += 2;
  else if (indicators.rsi > 50) bullishScore += 1;
  else if (indicators.rsi < 30) bullishScore += 2;
  else if (indicators.rsi < 50) bearishScore += 1;

  // MACD analysis
  if (indicators.macd.histogram > 0) bullishScore += 2;
  else bearishScore += 2;

  // EMA analysis
  if (currentPrice > indicators.ema.ema9) bullishScore += 1;
  if (currentPrice > indicators.ema.ema21) bullishScore += 1;
  if (currentPrice > indicators.ema.ema50) bullishScore += 1;

  // ADX analysis (trend strength)
  const trendMultiplier = Math.min(indicators.adx / 100, 1);

  // Determine direction
  const netScore = bullishScore - bearishScore;
  let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let strength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';

  if (netScore > 3) {
    direction = 'BUY';
    strength = netScore > 6 ? 'STRONG' : 'MODERATE';
  } else if (netScore < -3) {
    direction = 'SELL';
    strength = netScore < -6 ? 'STRONG' : 'MODERATE';
  }

  // Calculate confidence (0-100)
  const confidence = Math.min(100, Math.max(50, 50 + netScore * 10 + indicators.adx * 0.2));

  // Calculate entry, target, stop
  const atr = Math.max(...highs.slice(-14)) - Math.min(...lows.slice(-14));
  const entry = currentPrice;
  const target = direction === 'BUY' ? currentPrice + atr * 0.5 : currentPrice - atr * 0.5;
  const stop = direction === 'BUY' ? currentPrice - atr * 0.3 : currentPrice + atr * 0.3;
  const riskRewardRatio = Math.abs(target - entry) / Math.abs(entry - stop);

  const briefing = generateAIBriefing(symbol, direction, confidence, indicators);

  return {
    symbol,
    timestamp: Date.now(),
    direction,
    strength,
    confidence: Math.round(confidence),
    indicators,
    entry,
    target,
    stop,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    briefing,
  };
}

// ============================================================================
// AI BRIEFING GENERATION
// ============================================================================

/**
 * Generate AI-powered briefing based on signal analysis
 */
function generateAIBriefing(
  symbol: string,
  direction: 'BUY' | 'SELL' | 'NEUTRAL',
  confidence: number,
  indicators: TechnicalIndicators
): string {
  const rsiStatus =
    indicators.rsi > 70 ? 'overbought' : indicators.rsi < 30 ? 'oversold' : 'neutral';
  const macdStatus = indicators.macd.histogram > 0 ? 'bullish' : 'bearish';
  const trendStatus = indicators.adx > 25 ? 'strong' : 'weak';

  let briefing = `${symbol}/USDT shows ${direction === 'BUY' ? 'bullish' : direction === 'SELL' ? 'bearish' : 'neutral'} momentum. `;
  briefing += `RSI is ${rsiStatus} at ${indicators.rsi.toFixed(2)}, `;
  briefing += `MACD is ${macdStatus}, `;
  briefing += `and trend strength (ADX) is ${trendStatus} at ${indicators.adx.toFixed(2)}. `;
  briefing += `Confidence level: ${confidence.toFixed(0)}%. `;

  if (indicators.rsi > 70 || indicators.rsi < 30) {
    briefing += 'Extreme RSI levels suggest potential reversal. ';
  }

  if (indicators.stochastic.k > 80 || indicators.stochastic.k < 20) {
    briefing += 'Stochastic oscillator indicates potential pullback. ';
  }

  return briefing;
}

// ============================================================================
// FEAR & GREED INDEX
// ============================================================================

/**
 * Calculate Fear & Greed Index
 * Combines multiple market indicators to gauge overall sentiment
 */
export function calculateFearGreedIndex(
  rsi: number,
  volatility: number,
  dominantTrend: 'BULL' | 'BEAR' | 'NEUTRAL'
): FearGreedIndex {
  // Simplified calculation
  let score = 50; // Neutral baseline

  // RSI contribution
  if (rsi > 70) score -= 15; // Greed
  else if (rsi < 30) score += 15; // Fear

  // Volatility contribution
  if (volatility > 0.05) score += 10; // Fear
  else if (volatility < 0.02) score -= 10; // Greed

  // Trend contribution
  if (dominantTrend === 'BULL') score -= 10; // Greed
  else if (dominantTrend === 'BEAR') score += 10; // Fear

  score = Math.max(0, Math.min(100, score));

  let classification: 'Extreme Fear' | 'Fear' | 'Neutral' | 'Greed' | 'Extreme Greed';
  if (score < 20) classification = 'Extreme Fear';
  else if (score < 40) classification = 'Fear';
  else if (score < 60) classification = 'Neutral';
  else if (score < 80) classification = 'Greed';
  else classification = 'Extreme Greed';

  const recommendations: Record<typeof classification, string> = {
    'Extreme Fear': 'Accumulation opportunity - Consider buying',
    Fear: 'Cautious buying - Wait for confirmation',
    Neutral: 'Hold position - Monitor for breakout',
    Greed: 'Consider taking profits - Risk of pullback',
    'Extreme Greed': 'High risk - Prepare for correction',
  };

  return {
    value: score,
    classification,
    recommendation: recommendations[classification],
  };
}

// ============================================================================
// MARKET PULSE ANALYSIS
// ============================================================================

/**
 * Analyze overall market pulse across multiple symbols
 */
export function analyzeMarketPulse(signals: Signal[]): {
  averageConfidence: number;
  bullishCount: number;
  bearishCount: number;
  dominantTrend: 'BULL' | 'BEAR' | 'NEUTRAL';
} {
  if (signals.length === 0) {
    return {
      averageConfidence: 50,
      bullishCount: 0,
      bearishCount: 0,
      dominantTrend: 'NEUTRAL',
    };
  }

  const averageConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
  const bullishCount = signals.filter((s) => s.direction === 'BUY').length;
  const bearishCount = signals.filter((s) => s.direction === 'SELL').length;

  let dominantTrend: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL';
  if (bullishCount > bearishCount * 1.5) dominantTrend = 'BULL';
  else if (bearishCount > bullishCount * 1.5) dominantTrend = 'BEAR';

  return {
    averageConfidence: Math.round(averageConfidence),
    bullishCount,
    bearishCount,
    dominantTrend,
  };
}

// ============================================================================
// COMPREHENSIVE ANALYSIS
// ============================================================================

/**
 * Generate comprehensive enhanced analysis combining all factors
 */
export function generateEnhancedAnalysis(
  symbol: string,
  candles: Candle[],
  prices: number[],
  volumes: number[],
  highs: number[],
  lows: number[],
  currentPrice: number,
  allSignals: Signal[]
): EnhancedAnalysis {
  const signal = generateSignal(symbol, prices, volumes, highs, lows, currentPrice);

  const volatility = calculateVolatility(prices);
  const fearGreedIndex = calculateFearGreedIndex(
    signal.indicators.rsi,
    volatility,
    allSignals.length > 0
      ? allSignals.filter((s) => s.direction === 'BUY').length >
        allSignals.filter((s) => s.direction === 'SELL').length
        ? 'BULL'
        : 'BEAR'
      : 'NEUTRAL'
  );

  const marketPulse = analyzeMarketPulse(allSignals);

  const cvd = calculateCVD(candles);
  const volumeProfile = calculateVolumeProfile(candles);
  const marketProfile = calculateMarketProfile(candles, 30, 0.01); // Assuming 30 min TPO interval and 0.01 price tick size

  // For liquidity trap detection, we need key levels. For now, we'll use POC, VAH, VAL from Volume Profile as key levels.
  const keyLevels = [volumeProfile.poc, volumeProfile.vah, volumeProfile.val].filter(level => level !== 0);

  const stopHunts = detectStopHunt(candles);
  const liquidityTraps = detectLiquidityTrap(candles, keyLevels);
  const whaleTraps = detectWhaleTrap(candles);

  const trapDetections = [...stopHunts, ...liquidityTraps, ...whaleTraps];

  return {
    symbol,
    timestamp: Date.now(),
    signal,
    fearGreedIndex,
    marketPulse,
    aiBriefing: signal.briefing,
    cvd,
    volumeProfile,
    marketProfile,
    trapDetections,
  };
}

/**
 * Calculate price volatility
 */
function calculateVolatility(prices: number[], period: number = 20): number {
  if (prices.length < period) return 0;

  const recentPrices = prices.slice(-period);
  const mean = recentPrices.reduce((a, b) => a + b) / period;
  const variance =
    recentPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return stdDev / mean;
}

export default {
  calculateRSI,
  calculateStochastic,
  calculateMACD,
  calculateEMA,
  calculateADX,
  calculateVWAP,
  calculateOBV,
  generateSignal,
  calculateFearGreedIndex,
  analyzeMarketPulse,
  generateEnhancedAnalysis,
};
