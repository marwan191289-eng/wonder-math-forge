/**
 * Whale Detection Tests
 * Validates whale wall identification and analysis
 *
 * NOTE: rewritten during the FLUX-MASTER merge — the original file called
 * detectWalls(bidsArray, asksArray, price) instead of detectWalls(book, price),
 * read wall.usdSize (real field is valueUsd), assumed calculateWallImpact takes
 * a single wall + price and returns a signed number (it actually takes a Wall[]
 * + side and returns an unsigned 0..1 pressure score), and imported a function
 * identifyStopHuntLevels that doesn't exist (the real export is
 * detectStopHuntLevels(walls, currentPrice, recentHigh, recentLow)). All of
 * this is pre-existing test/implementation drift from the source repo.
 */

import { describe, it, expect } from 'vitest';
import {
  detectWalls,
  calculateWallImpact,
  detectStopHuntLevels,
  type Wall,
} from './whale-detection';
import type { BinanceOrderBook } from './binance-client';

function book(bids: [number, number][], asks: [number, number][]): BinanceOrderBook {
  return {
    bids: bids.map(([p, q]) => [String(p), String(q)]),
    asks: asks.map(([p, q]) => [String(p), String(q)]),
    lastUpdateId: 1,
  };
}

function normalBookSide(bigLevel: [number, number], normalQty: number, count = 20): [number, number][] {
  const levels: [number, number][] = [bigLevel];
  for (let i = 1; i < count; i++) {
    levels.push([bigLevel[0] - i * 0.1, normalQty]);
  }
  return levels;
}

describe('Whale Detection', () => {
  describe('detectWalls', () => {
    it('should detect large bid wall', () => {
      const walls = detectWalls(
        book(normalBookSide([100, 100], 1), [[101, 1], [101.5, 1], [102, 1]]),
        100.5,
        5000
      );
      expect(walls.bidWalls.length).toBeGreaterThan(0);
      expect(walls.bidWalls[0].valueUsd).toBeGreaterThan(9000);
    });

    it('should detect large ask wall', () => {
      const walls = detectWalls(
        book([[100, 1], [99.5, 1], [99, 1]], normalBookSide([101, 100], 1)),
        100.5,
        5000
      );
      expect(walls.askWalls.length).toBeGreaterThan(0);
      expect(walls.askWalls[0].valueUsd).toBeGreaterThan(9000);
    });

    it('should calculate proximity score within bounds', () => {
      const walls = detectWalls(
        book([[100, 10], [99, 1], [98, 1]], [[101, 10], [102, 1], [103, 1]]),
        100,
        500
      );
      if (walls.bidWalls.length > 0) {
        expect(walls.bidWalls[0].proximityScore).toBeGreaterThanOrEqual(0);
        expect(walls.bidWalls[0].proximityScore).toBeLessThanOrEqual(100);
      }
    });

    it('should not detect small orders as walls', () => {
      const walls = detectWalls(
        book([[100, 0.1], [99, 0.1], [98, 0.1]], [[101, 0.1], [102, 0.1], [103, 0.1]]),
        100
        // default minUsdSize = 100,000 — these are ~10 usd orders, nowhere close
      );
      expect(walls.bidWalls.length).toBe(0);
      expect(walls.askWalls.length).toBe(0);
    });

    it('should handle an empty order book', () => {
      const walls = detectWalls(book([], []), 100);
      expect(walls.bidWalls).toEqual([]);
      expect(walls.askWalls).toEqual([]);
    });

    it('should handle very large walls', () => {
      const walls = detectWalls(book(normalBookSide([100, 10001], 1), [[101, 1]]), 100.5, 5000);
      expect(walls.bidWalls.length).toBeGreaterThan(0);
      expect(walls.bidWalls[0].valueUsd).toBeGreaterThan(1000000);
    });
  });

  describe('calculateWallImpact', () => {
    const bidWall: Wall = {
      type: 'bid',
      price: 99,
      quantity: 100,
      valueUsd: 9900,
      distanceFromPrice: 1,
      proximityScore: 80,
    };
    const askWall: Wall = {
      type: 'ask',
      price: 101,
      quantity: 100,
      valueUsd: 10100,
      distanceFromPrice: 1,
      proximityScore: 80,
    };

    it('should return 0 when no walls match the requested side', () => {
      expect(calculateWallImpact([bidWall], 'ask')).toBe(0);
    });

    it('should return a positive 0..1 score for matching bid walls', () => {
      const impact = calculateWallImpact([bidWall], 'bid');
      expect(impact).toBeGreaterThan(0);
      expect(impact).toBeLessThanOrEqual(1);
    });

    it('should return a positive 0..1 score for matching ask walls', () => {
      const impact = calculateWallImpact([askWall], 'ask');
      expect(impact).toBeGreaterThan(0);
      expect(impact).toBeLessThanOrEqual(1);
    });

    it('should weight closer walls (higher proximityScore) more heavily', () => {
      const close: Wall = { ...bidWall, proximityScore: 90, valueUsd: 9900 };
      const far: Wall = { ...bidWall, proximityScore: 20, valueUsd: 9900 };
      expect(calculateWallImpact([close], 'bid')).toBeGreaterThan(calculateWallImpact([far], 'bid'));
    });
  });

  describe('detectStopHuntLevels', () => {
    it('should identify a stop-hunt level above current price for an ask wall', () => {
      const walls: Wall[] = [
        { type: 'ask', price: 103, quantity: 10, valueUsd: 1030, distanceFromPrice: 3, proximityScore: 60 },
      ];
      const levels = detectStopHuntLevels(walls, 100, /* recentHigh */ 102.5, /* recentLow */ 98);
      expect(levels.length).toBeGreaterThan(0);
      expect(levels[0].level).toBeGreaterThan(100);
      expect(levels[0].type).toBe('ask');
    });

    it('should identify a stop-hunt level below current price for a bid wall', () => {
      const walls: Wall[] = [
        { type: 'bid', price: 97, quantity: 10, valueUsd: 970, distanceFromPrice: 3, proximityScore: 60 },
      ];
      const levels = detectStopHuntLevels(walls, 100, /* recentHigh */ 102, /* recentLow */ 97.5);
      expect(levels.length).toBeGreaterThan(0);
      expect(levels[0].level).toBeLessThan(100);
      expect(levels[0].type).toBe('bid');
    });

    it('should keep probability within 0..1', () => {
      const walls: Wall[] = [
        { type: 'bid', price: 97, quantity: 10, valueUsd: 970, distanceFromPrice: 3, proximityScore: 60 },
      ];
      const levels = detectStopHuntLevels(walls, 100, 102, 97.5);
      for (const l of levels) {
        expect(l.probability).toBeGreaterThanOrEqual(0);
        expect(l.probability).toBeLessThanOrEqual(1);
      }
    });
  });
});
