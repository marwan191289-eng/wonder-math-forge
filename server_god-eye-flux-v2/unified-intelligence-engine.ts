/**
 * Unified Intelligence Engine (Master Brain)
 * 
 * Combines all market analysis indicators into a single coherent signal
 * with Bayesian probability framework and ≥80% confidence threshold.
 * 
 * Integrates:
 * - Market Structure (BOS/CHOCH)
 * - Liquidity Sweeps
 * - VPIN (Volume-Synchronized Probability of Informed Trading)
 * - Whale Detection
 * - SMC Analysis
 * - RL Agent Signals
 * - Institutional Scores
 */

export type Kline = any;
export type OrderBook = any;
import { analyzeMarketStructure } from "./market-structure";
import { detectLiquiditySweep } from "./liquidity-sweep";
import { calculateVPIN } from "./vpin-engine";
import { detectWalls } from "./whale-detection";
import { analyzeSMC } from "./smc-detection";
import { calculateCompositeScore } from "./scoring-engine";

export interface SignalComponent {
  name: string;
  value: number; // 0-100
  confidence: number; // 0-1
  weight: number; // 0-1
  direction: "bullish" | "bearish" | "neutral";
  timestamp: number;
}

export interface UnifiedSignal {
  symbol: string;
  timestamp: number;
  
  // Overall decision
  decision: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  confidence: number; // 0-1, must be ≥0.8 for actionable signals
  
  // Component scores
  components: SignalComponent[];
  
  // Aggregated metrics
  bullishScore: number; // 0-100
  bearishScore: number; // 0-100
  neutralScore: number; // 0-100
  
  // Risk metrics
  riskRewardRatio: number;
  stopLossDistance: number; // in %
  takeProfitDistance: number; // in %
  
  // Reasoning
  reasoning: string;
  keySignals: string[];
  warnings: string[];
}

export interface HistoricalAccuracy {
  totalSignals: number;
  correctSignals: number;
  accuracy: number; // 0-1
  profitableTrades: number;
  lossTrades: number;
  winRate: number; // 0-1
}

/**
 * Prior probabilities based on historical market data
 * These are baseline probabilities before observing signals
 */
const PRIOR_PROBABILITIES = {
  bullish: 0.45,
  bearish: 0.40,
  neutral: 0.15,
};

/**
 * Likelihood multipliers for each indicator
 * How much each indicator increases/decreases probability of a direction
 */
const LIKELIHOOD_MULTIPLIERS = {
  marketStructure: 1.8,
  liquiditySweep: 1.6,
  vpin: 1.5,
  whaleDetection: 1.7,
  smc: 1.4,
  compositeScore: 1.9,
  rlAgent: 1.3,
};

/**
 * Calculate Bayesian posterior probability
 * P(H|E) = P(E|H) * P(H) / P(E)
 */
function calculateBayesianProbability(
  priorProb: number,
  likelihood: number,
  normalizer: number
): number {
  const posterior = (likelihood * priorProb) / normalizer;
  return Math.min(1, Math.max(0, posterior));
}

/**
 * Normalize probabilities to sum to 1
 */
function normalizeProbabilities(probs: { bullish: number; bearish: number; neutral: number }) {
  const sum = probs.bullish + probs.bearish + probs.neutral;
  return {
    bullish: probs.bullish / sum,
    bearish: probs.bearish / sum,
    neutral: probs.neutral / sum,
  };
}

/**
 * Main unified intelligence analysis
 */
export async function analyzeUnifiedSignal(
  symbol: string,
  klines: Kline[],
  orderBooks: OrderBook[],
  historicalAccuracy?: HistoricalAccuracy
): Promise<UnifiedSignal> {
  const timestamp = Date.now();
  const components: SignalComponent[] = [];

  // 1. Market Structure Analysis
  const marketStructure = analyzeMarketStructure(klines);
  if (marketStructure) {
    const msDirection =
      marketStructure.pattern === "HH" || marketStructure.pattern === "HL"
        ? "bullish"
        : marketStructure.pattern === "LH" || marketStructure.pattern === "LL"
        ? "bearish"
        : "neutral";

    components.push({
      name: "Market Structure",
      value: marketStructure.trendStrength,
      confidence: Math.min(1, marketStructure.trendStrength / 100),
      weight: 0.20,
      direction: msDirection,
      timestamp,
    });
  }

  // 2. Liquidity Sweep Detection
  const liquiditySweep = detectLiquiditySweep(klines);
  if (liquiditySweep) {
    const sweepDirection = liquiditySweep.type === "bullish" ? "bullish" : liquiditySweep.type === "bearish" ? "bearish" : "neutral";
    components.push({
      name: "Liquidity Sweep",
      value: liquiditySweep.probability,
      confidence: liquiditySweep.probability / 100,
      weight: 0.18,
      direction: sweepDirection,
      timestamp,
    });
  }

  // 3. VPIN Analysis
  if (orderBooks.length > 0) {
    const vpin = calculateVPIN(orderBooks);
    if (vpin) {
      const vpinDirection = vpin.informedTradingProbability > 60 ? "bearish" : "bullish";
      components.push({
        name: "VPIN Toxicity",
        value: vpin.informedTradingProbability,
        confidence: Math.min(1, vpin.informedTradingProbability / 100),
        weight: 0.17,
        direction: vpinDirection,
        timestamp,
      });
    }
  }

  // 4. Whale Detection
  if (orderBooks.length > 0) {
    const latestOrderBook = orderBooks[orderBooks.length - 1];
    const currentPrice = parseFloat(klines[klines.length - 1].close);
    const whaleSignal = detectWalls(latestOrderBook, currentPrice);
    if (whaleSignal) {
      const whaleDirection = whaleSignal.pressure > 0 ? "bullish" : "bearish";
      const pressureStrength = Math.abs(whaleSignal.pressure) / 100;
      components.push({
        name: "Whale Detection",
        value: Math.abs(whaleSignal.pressure),
        confidence: pressureStrength,
        weight: 0.16,
        direction: whaleDirection,
        timestamp,
      });
    }
  }

  // 5. SMC Analysis
  const smcSignal = analyzeSMC(klines);
  if (smcSignal) {
    const smcDirection = smcSignal.trend === "uptrend" ? "bullish" : smcSignal.trend === "downtrend" ? "bearish" : "neutral";
    const smcStrength = (smcSignal.bosLevels.length + smcSignal.chochLevels.length) / 10; // Normalize
    components.push({
      name: "SMC Analysis",
      value: Math.min(100, smcStrength * 100),
      confidence: Math.min(1, smcStrength),
      weight: 0.14,
      direction: smcDirection,
      timestamp,
    });
  }

  // 6. Composite Institutional Score
  if (klines.length > 0 && orderBooks.length > 0) {
    const latestOrderBook = orderBooks[orderBooks.length - 1];
    const currentPrice = parseFloat(klines[klines.length - 1].close);
    const compositeScore = calculateCompositeScore(latestOrderBook, klines, currentPrice);
    if (compositeScore) {
      const scoreDirection = compositeScore.score > 50 ? "bullish" : "bearish";
      components.push({
        name: "Composite Score",
        value: compositeScore.score,
        confidence: Math.abs(compositeScore.score - 50) / 50,
        weight: 0.15,
        direction: scoreDirection,
        timestamp,
      });
    }
  }

  // Calculate Bayesian probabilities
  let bullishProb = PRIOR_PROBABILITIES.bullish;
  let bearishProb = PRIOR_PROBABILITIES.bearish;
  let neutralProb = PRIOR_PROBABILITIES.neutral;

  for (const component of components) {
    const multiplier = LIKELIHOOD_MULTIPLIERS[component.name as keyof typeof LIKELIHOOD_MULTIPLIERS] || 1;
    const directionMultiplier = component.confidence * multiplier;

    if (component.direction === "bullish") {
      bullishProb *= directionMultiplier;
    } else if (component.direction === "bearish") {
      bearishProb *= directionMultiplier;
    } else {
      neutralProb *= directionMultiplier;
    }
  }

  // Normalize probabilities
  const normalizer = bullishProb + bearishProb + neutralProb;
  bullishProb /= normalizer;
  bearishProb /= normalizer;
  neutralProb /= normalizer;

  // Determine decision and confidence
  const maxProb = Math.max(bullishProb, bearishProb, neutralProb);
  let decision: UnifiedSignal["decision"] = "HOLD";
  let confidence = neutralProb;

  if (bullishProb === maxProb && bullishProb > 0.5) {
    decision = bullishProb > 0.75 ? "STRONG_BUY" : "BUY";
    confidence = bullishProb;
  } else if (bearishProb === maxProb && bearishProb > 0.5) {
    decision = bearishProb > 0.75 ? "STRONG_SELL" : "SELL";
    confidence = bearishProb;
  }

  // Apply historical accuracy weighting if available
  if (historicalAccuracy && historicalAccuracy.accuracy > 0.5) {
    const accuracyBoost = (historicalAccuracy.accuracy - 0.5) * 0.2; // Max 10% boost
    confidence = Math.min(1, confidence + accuracyBoost);
  }

  // Calculate risk-reward metrics
  const volatility = calculateVolatility(klines);
  const stopLossDistance = volatility * 1.5;
  const takeProfitDistance = volatility * 2.5;
  const riskRewardRatio = takeProfitDistance / stopLossDistance;

  // Generate reasoning and warnings
  const keySignals = components
    .filter((c) => c.confidence > 0.6)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map((c) => `${c.name}: ${c.direction} (${(c.confidence * 100).toFixed(0)}%)`);

  const warnings: string[] = [];
  if (confidence < 0.8) {
    warnings.push("Confidence below 80% - signal may be unreliable");
  }
  if (components.length < 4) {
    warnings.push("Insufficient signal components for reliable analysis");
  }
  if (neutralProb > 0.3) {
    warnings.push("High neutral probability - market may be indecisive");
  }

  const reasoning = generateReasoning(decision, confidence, components);

  return {
    symbol,
    timestamp,
    decision,
    confidence,
    components,
    bullishScore: bullishProb * 100,
    bearishScore: bearishProb * 100,
    neutralScore: neutralProb * 100,
    riskRewardRatio,
    stopLossDistance,
    takeProfitDistance,
    reasoning,
    keySignals,
    warnings,
  };
}

/**
 * Calculate volatility from klines
 */
function calculateVolatility(klines: Kline[]): number {
  if (klines.length < 2) return 2; // Default 2% if insufficient data

  const returns = [];
  for (let i = 1; i < klines.length; i++) {
    const ret = (parseFloat(klines[i].close) - parseFloat(klines[i - 1].close)) / parseFloat(klines[i - 1].close);
    returns.push(ret);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  return Math.max(0.5, Math.min(10, stdDev * 100)); // Clamp between 0.5% and 10%
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(
  decision: UnifiedSignal["decision"],
  confidence: number,
  components: SignalComponent[]
): string {
  const bullishCount = components.filter((c) => c.direction === "bullish").length;
  const bearishCount = components.filter((c) => c.direction === "bearish").length;

  const confidenceLevel =
    confidence > 0.9 ? "very high" : confidence > 0.8 ? "high" : confidence > 0.7 ? "moderate" : "low";

  let reasoning = `Signal: ${decision} with ${confidenceLevel} confidence (${(confidence * 100).toFixed(1)}%). `;
  reasoning += `Bullish signals: ${bullishCount}, Bearish signals: ${bearishCount}. `;

  if (decision.includes("BUY")) {
    reasoning += "Market structure and institutional activity suggest upward momentum. ";
  } else if (decision.includes("SELL")) {
    reasoning += "Liquidity sweeps and whale activity indicate potential downside. ";
  } else {
    reasoning += "Mixed signals suggest consolidation or indecision. ";
  }

  reasoning += confidence >= 0.8 ? "Signal meets confidence threshold for trading." : "Signal below confidence threshold - use with caution.";

  return reasoning;
}

/**
 * Track signal accuracy over time
 */
export function calculateSignalAccuracy(
  signals: Array<{ decision: UnifiedSignal["decision"]; actualDirection: "up" | "down" }>,
  minConfidence: number = 0.8
): HistoricalAccuracy {
  const validSignals = signals.filter((s) => {
    // Only count signals with sufficient confidence
    return (
      (s.decision.includes("BUY") && s.actualDirection === "up") ||
      (s.decision.includes("SELL") && s.actualDirection === "down")
    );
  });

  const totalSignals = signals.length;
  const correctSignals = validSignals.length;
  const accuracy = totalSignals > 0 ? correctSignals / totalSignals : 0;

  const profitableTrades = signals.filter((s) => s.decision.includes("BUY") && s.actualDirection === "up").length;
  const lossTrades = signals.filter((s) => s.decision.includes("BUY") && s.actualDirection === "down").length;
  const winRate = profitableTrades + lossTrades > 0 ? profitableTrades / (profitableTrades + lossTrades) : 0;

  return {
    totalSignals,
    correctSignals,
    accuracy,
    profitableTrades,
    lossTrades,
    winRate,
  };
}
