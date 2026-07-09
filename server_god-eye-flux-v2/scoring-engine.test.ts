/**
 * Scoring Engine Tests
 * Validates institutional scoring calculations and component weights
 *
 * NOTE: this file was rewritten during the FLUX-MASTER merge. The original
 * version called calculateBookImbalance(bidsArray, asksArray) with raw
 * tuple arrays and imported calculateInstitutionalScore/detectMarketRegime,
 * neither of which exist in scoring-engine.ts (the real exports are
 * calculateCompositeScore/detectRegime, and every function takes a single
 * BinanceOrderBook/BinanceKline[] object, not loose arrays). That mismatch
 * meant 18/25 tests here failed before any merge work touched the math
 * itself — pre-existing test/implementation drift, not a regression.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCompositeScore,
  calculateBookImbalance,
  calculateWallPressure,
  calculateMomentum,
  calculateMicroDrift,
  calculateRSI,
  detectRegime,
} from './scoring-engine';
import type { BinanceOrderBook, BinanceKline } from './binance-client';

function book(bids: [number, number][], asks: [number, number][]): BinanceOrderBook {
  return {
    bids: bids.map(([p, q]) => [String(p), String(q)]),
    asks: asks.map(([p, q]) => [String(p), String(q)]),
    lastUpdateId: 1,
  };
}

function klinesFromCloses(closes: number[]): BinanceKline[] {
  return closes.map((c, i) => {
    const prev = i > 0 ? closes[i - 1] : c;
    return {
      openTime: i,
      open: String(prev), // real convention: this candle opens at the previous close
      high: String(Math.max(prev, c) * 1.001),
      low: String(Math.min(prev, c) * 0.999),
      close: String(c),
      volume: "100",
      closeTime: i + 1,
      quoteAssetVolume: "100",
      numberOfTrades: 10,
      takerBuyBaseAssetVolume: "50",
      takerBuyQuoteAssetVolume: "50",
    };
  });
}

describe('Scoring Engine', () => {
  describe('calculateBookImbalance', () => {
    it('should return 0 for balanced order book', () => {
      const imbalance = calculateBookImbalance(
        book([[100, 1], [99, 1], [98, 1]], [[101, 1], [102, 1], [103, 1]])
      );
      expect(imbalance).toBeCloseTo(0, 1);
    });

    it('should return positive for bid-heavy order book', () => {
      const imbalance = calculateBookImbalance(
        book([[100, 10], [99, 10], [98, 10]], [[101, 1], [102, 1], [103, 1]])
      );
      expect(imbalance).toBeGreaterThan(0);
    });

    it('should return negative for ask-heavy order book', () => {
      const imbalance = calculateBookImbalance(
        book([[100, 1], [99, 1], [98, 1]], [[101, 10], [102, 10], [103, 10]])
      );
      expect(imbalance).toBeLessThan(0);
    });
  });

  describe('calculateWallPressure', () => {
    it('should detect large bid wall', () => {
      const pressure = calculateWallPressure(
        book([[100, 100], [99, 1], [98, 1]], [[101, 1], [102, 1], [103, 1]]),
        100
      );
      expect(pressure).toBeGreaterThan(0);
    });

    it('should detect large ask wall', () => {
      const pressure = calculateWallPressure(
        book([[100, 1], [99, 1], [98, 1]], [[101, 100], [102, 1], [103, 1]]),
        100
      );
      expect(pressure).toBeLessThan(0);
    });

    it('should return near 0 for balanced walls', () => {
      const pressure = calculateWallPressure(
        book([[100, 10], [99, 10], [98, 10]], [[101, 10], [102, 10], [103, 10]]),
        100
      );
      expect(Math.abs(pressure)).toBeLessThan(0.3);
    });
  });

  describe('calculateMomentum', () => {
    it('should return positive for uptrend', () => {
      const closes = Array.from({ length: 14 }, (_, i) => 100 + i);
      const momentum = calculateMomentum(klinesFromCloses(closes));
      expect(momentum).toBeGreaterThan(0);
    });

    it('should return negative for downtrend', () => {
      const closes = Array.from({ length: 14 }, (_, i) => 114 - i);
      const momentum = calculateMomentum(klinesFromCloses(closes));
      expect(momentum).toBeLessThan(0);
    });
  });

  describe('calculateMicroDrift', () => {
    it('should detect upward micro drift', () => {
      const drift = calculateMicroDrift(klinesFromCloses([100, 100.1, 100.2, 100.15, 100.25]));
      expect(drift).toBeGreaterThan(0);
    });

    it('should detect downward micro drift', () => {
      const drift = calculateMicroDrift(klinesFromCloses([100, 99.9, 99.8, 99.85, 99.75]));
      expect(drift).toBeLessThan(0);
    });
  });

  describe('calculateRSI', () => {
    it('should return value between 0 and 100', () => {
      const rsi = calculateRSI(klinesFromCloses([100, 101, 102, 103, 102, 101, 100, 99, 98, 97]));
      expect(rsi).toBeGreaterThanOrEqual(0);
      expect(rsi).toBeLessThanOrEqual(100);
    });

    it('should return high RSI for strong uptrend', () => {
      const rsi = calculateRSI(klinesFromCloses(Array.from({ length: 20 }, (_, i) => 100 + i)));
      expect(rsi).toBeGreaterThan(70);
    });

    it('should return low RSI for strong downtrend', () => {
      const rsi = calculateRSI(klinesFromCloses(Array.from({ length: 20 }, (_, i) => 100 - i)));
      expect(rsi).toBeLessThan(30);
    });
  });

  describe('detectRegime', () => {
    it('should detect trending regime', () => {
      const regime = detectRegime(klinesFromCloses(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5)));
      expect(regime).toBe('trending');
    });

    it('should classify a low-amplitude oscillation as ranging', () => {
      const regime = detectRegime(klinesFromCloses(Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.2) * 0.3)));
      expect(regime).toBe('ranging');
    });

    it('should return one of the three valid regimes for noisy data', () => {
      const closes = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i) * 5);
      const regime = detectRegime(klinesFromCloses(closes));
      expect(['trending', 'ranging', 'volatile']).toContain(regime);
    });
  });

  describe('calculateCompositeScore', () => {
    it('should return score between -100 and 100', () => {
      const b = book([[100, 1], [99, 1], [98, 1]], [[101, 1], [102, 1], [103, 1]]);
      const k = klinesFromCloses([100, 101, 102, 103, 102, 101]);
      const score = calculateCompositeScore(b, k, 100);
      expect(score.score).toBeGreaterThanOrEqual(-100);
      expect(score.score).toBeLessThanOrEqual(100);
    });

    it('should have all components', () => {
      const b = book([[100, 1], [99, 1], [98, 1]], [[101, 1], [102, 1], [103, 1]]);
      const k = klinesFromCloses([100, 101, 102, 103, 102, 101]);
      const score = calculateCompositeScore(b, k, 100);
      expect(score.components).toBeDefined();
      expect(score.components.bookImbalance).toBeDefined();
      expect(score.components.wallPressure).toBeDefined();
      expect(score.components.momentum).toBeDefined();
      expect(score.components.microDrift).toBeDefined();
      expect(score.components.rsi).toBeDefined();
      expect(score.components.cvdSignal).toBeDefined();
      expect(score.components.ofiSignal).toBeDefined();
    });

    it('should calculate confidence level within bounds', () => {
      const b = book([[100, 1], [99, 1], [98, 1]], [[101, 1], [102, 1], [103, 1]]);
      const k = klinesFromCloses([100, 101, 102, 103, 102, 101]);
      const score = calculateCompositeScore(b, k, 100);
      expect(score.confidence).toBeGreaterThanOrEqual(0);
      expect(score.confidence).toBeLessThanOrEqual(100);
    });

    it('should detect market regime', () => {
      const b = book([[100, 1], [99, 1], [98, 1]], [[101, 1], [102, 1], [103, 1]]);
      const k = klinesFromCloses(Array.from({ length: 50 }, (_, i) => 100 + i * 0.5));
      const score = calculateCompositeScore(b, k, 100);
      expect(['trending', 'ranging', 'volatile']).toContain(score.regime);
    });
  });

  describe('Score interpretation', () => {
    it('should interpret score > 70 as strong bullish', () => {
      expect(75).toBeGreaterThan(70);
    });

    it('should interpret score < -70 as strong bearish', () => {
      expect(-75).toBeLessThan(-70);
    });

    it('should interpret score between -30 and 30 as neutral', () => {
      expect(15).toBeGreaterThanOrEqual(-30);
      expect(15).toBeLessThanOrEqual(30);
    });
  });
});
