/**
 * Data Validation & Quality Pipeline
 * Ensures all market data meets quality standards before persistence
 */

import { z } from 'zod';
import type { BinanceKline, BinanceOrderBook, BinanceTicker } from './binance-client';

/**
 * Validation Schemas
 */
export const KlineSchema = z.object({
  openTime: z.number().positive(),
  open: z.string().regex(/^\d+(\.\d+)?$/),
  high: z.string().regex(/^\d+(\.\d+)?$/),
  low: z.string().regex(/^\d+(\.\d+)?$/),
  close: z.string().regex(/^\d+(\.\d+)?$/),
  volume: z.string().regex(/^\d+(\.\d+)?$/),
  closeTime: z.number().positive(),
  quoteAssetVolume: z.string().regex(/^\d+(\.\d+)?$/),
  numberOfTrades: z.number().nonnegative(),
  takerBuyBaseAssetVolume: z.string().regex(/^\d+(\.\d+)?$/),
  takerBuyQuoteAssetVolume: z.string().regex(/^\d+(\.\d+)?$/),
});

export const OrderBookSchema = z.object({
  bids: z.array(z.tuple([z.string(), z.string()])),
  asks: z.array(z.tuple([z.string(), z.string()])),
  lastUpdateId: z.number(),
});

export const TickerSchema = z.object({
  symbol: z.string(),
  priceChange: z.string(),
  priceChangePercent: z.string(),
  weightedAvgPrice: z.string(),
  prevClosePrice: z.string(),
  lastPrice: z.string(),
  lastQty: z.string(),
  bidPrice: z.string(),
  bidQty: z.string(),
  askPrice: z.string(),
  askQty: z.string(),
  openPrice: z.string(),
  highPrice: z.string(),
  lowPrice: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  openTime: z.number(),
  closeTime: z.number(),
  firstId: z.number(),
  lastId: z.number(),
  count: z.number(),
});

/**
 * Data Quality Report
 */
export interface DataQualityReport {
  isValid: boolean;
  qualityScore: number;
  errors: string[];
  warnings: string[];
  cleanedData: any;
}

/**
 * Validate and clean kline data
 */
export function validateAndCleanKline(raw: any): DataQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let qualityScore = 100;

  try {
    const parsed = KlineSchema.parse(raw);

    const open = parseFloat(parsed.open);
    const high = parseFloat(parsed.high);
    const low = parseFloat(parsed.low);
    const close = parseFloat(parsed.close);
    const volume = parseFloat(parsed.volume);

    if (high < low) {
      errors.push('High price is less than low price');
      qualityScore -= 25;
    }
    if (close < low || close > high) {
      errors.push('Close price outside high/low range');
      qualityScore -= 25;
    }
    if (open < low || open > high) {
      errors.push('Open price outside high/low range');
      qualityScore -= 15;
    }
    if (volume === 0) {
      warnings.push('Zero volume candle');
      qualityScore -= 10;
    }
    if (parsed.numberOfTrades === 0) {
      warnings.push('No trades in candle');
      qualityScore -= 5;
    }

    if (parsed.closeTime <= parsed.openTime) {
      errors.push('Close time is before or equal to open time');
      qualityScore -= 20;
    }

    return {
      isValid: errors.length === 0,
      qualityScore: Math.max(0, qualityScore),
      errors,
      warnings,
      cleanedData: parsed,
    };
  } catch (error) {
    return {
      isValid: false,
      qualityScore: 0,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      warnings: [],
      cleanedData: null,
    };
  }
}

/**
 * Validate and clean order book data
 */
export function validateAndCleanOrderBook(raw: any): DataQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let qualityScore = 100;

  try {
    const parsed = OrderBookSchema.parse(raw);

    if (parsed.bids.length === 0 || parsed.asks.length === 0) {
      errors.push('Empty order book (no bids or asks)');
      qualityScore -= 50;
    }

    const bidPrices = new Set(parsed.bids.map(b => b[0]));
    if (bidPrices.size < parsed.bids.length) {
      errors.push('Duplicate bid prices detected');
      qualityScore -= 20;
    }

    const askPrices = new Set(parsed.asks.map(a => a[0]));
    if (askPrices.size < parsed.asks.length) {
      errors.push('Duplicate ask prices detected');
      qualityScore -= 20;
    }

    if (parsed.bids.length > 0 && parsed.asks.length > 0) {
      const bestBid = parseFloat(parsed.bids[0][0]);
      const bestAsk = parseFloat(parsed.asks[0][0]);

      if (bestBid >= bestAsk) {
        errors.push('Bid-ask spread inverted');
        qualityScore -= 30;
      }

      const spread = (bestAsk - bestBid) / bestBid;
      if (spread > 0.01) {
        warnings.push('Unusually large bid-ask spread (>1%)');
        qualityScore -= 10;
      }
    }

    const zeroQtyBids = parsed.bids.filter(b => parseFloat(b[1]) === 0).length;
    const zeroQtyAsks = parsed.asks.filter(a => parseFloat(a[1]) === 0).length;
    if (zeroQtyBids > 0 || zeroQtyAsks > 0) {
      warnings.push(`${zeroQtyBids + zeroQtyAsks} zero-quantity levels`);
      qualityScore -= 5;
    }

    return {
      isValid: errors.length === 0,
      qualityScore: Math.max(0, qualityScore),
      errors,
      warnings,
      cleanedData: parsed,
    };
  } catch (error) {
    return {
      isValid: false,
      qualityScore: 0,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      warnings: [],
      cleanedData: null,
    };
  }
}

/**
 * Validate and clean ticker data
 */
export function validateAndCleanTicker(raw: any): DataQualityReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  let qualityScore = 100;

  try {
    const parsed = TickerSchema.parse(raw);

    const lastPrice = parseFloat(parsed.lastPrice);
    const highPrice = parseFloat(parsed.highPrice);
    const lowPrice = parseFloat(parsed.lowPrice);
    const openPrice = parseFloat(parsed.openPrice);
    const bidPrice = parseFloat(parsed.bidPrice);
    const askPrice = parseFloat(parsed.askPrice);

    if (lastPrice > highPrice || lastPrice < lowPrice) {
      errors.push('Last price outside 24h high/low range');
      qualityScore -= 20;
    }

    if (highPrice < lowPrice) {
      errors.push('24h high is less than 24h low');
      qualityScore -= 25;
    }

    if (bidPrice >= askPrice) {
      errors.push('Current bid >= ask');
      qualityScore -= 25;
    }

    const volume = parseFloat(parsed.volume);
    if (volume === 0) {
      warnings.push('Zero 24h volume');
      qualityScore -= 15;
    }

    if (parsed.closeTime <= parsed.openTime) {
      errors.push('Close time before open time');
      qualityScore -= 20;
    }

    return {
      isValid: errors.length === 0,
      qualityScore: Math.max(0, qualityScore),
      errors,
      warnings,
      cleanedData: parsed,
    };
  } catch (error) {
    return {
      isValid: false,
      qualityScore: 0,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      warnings: [],
      cleanedData: null,
    };
  }
}

/**
 * Data Quality Monitor
 */
export class DataQualityMonitor {
  private validationHistory: Map<string, number[]> = new Map();
  private maxHistorySize = 100;

  recordValidation(symbol: string, qualityScore: number) {
    if (!this.validationHistory.has(symbol)) {
      this.validationHistory.set(symbol, []);
    }

    const history = this.validationHistory.get(symbol)!;
    history.push(qualityScore);

    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  getAverageQuality(symbol: string): number {
    const history = this.validationHistory.get(symbol) || [];
    if (history.length === 0) return 100;

    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  }

  getQualityTrend(symbol: string): 'improving' | 'stable' | 'degrading' {
    const history = this.validationHistory.get(symbol) || [];
    if (history.length < 10) return 'stable';

    const recent = history.slice(-10);
    const older = history.slice(-20, -10);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const diff = recentAvg - olderAvg;
    if (diff > 5) return 'improving';
    if (diff < -5) return 'degrading';
    return 'stable';
  }
}

export const dataQualityMonitor = new DataQualityMonitor();
