/**
 * Whale Wall Detection Engine
 * Identifies large orders (walls) in the order book
 */

import type { BinanceOrderBook } from './binance-client';

export interface Wall {
  type: 'bid' | 'ask';
  price: number;
  quantity: number;
  valueUsd: number;
  distanceFromPrice: number; // percentage
  proximityScore: number; // 0-100, higher = closer to price
}

export interface WallAnalysis {
  bidWalls: Wall[];
  askWalls: Wall[];
  totalBidWallUsd: number;
  totalAskWallUsd: number;
  pressure: number; // -100 to 100
  significance: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Detect whale walls in order book
 * A wall is defined as an order significantly larger than surrounding orders
 */
export function detectWalls(book: BinanceOrderBook, currentPrice: number, minUsdSize: number = 100000): WallAnalysis {
  const bidWalls: Wall[] = [];
  const askWalls: Wall[] = [];

  // Analyze bids
  if (book.bids && book.bids.length > 0) {
    const bidWallsDetected = detectWallsInSide(book.bids, currentPrice, 'bid', minUsdSize);
    bidWalls.push(...bidWallsDetected);
  }

  // Analyze asks
  if (book.asks && book.asks.length > 0) {
    const askWallsDetected = detectWallsInSide(book.asks, currentPrice, 'ask', minUsdSize);
    askWalls.push(...askWallsDetected);
  }

  // Calculate metrics
  const totalBidWallUsd = bidWalls.reduce((sum, w) => sum + w.valueUsd, 0);
  const totalAskWallUsd = askWalls.reduce((sum, w) => sum + w.valueUsd, 0);

  // Calculate pressure (-100 = all ask walls, +100 = all bid walls)
  const totalWallUsd = totalBidWallUsd + totalAskWallUsd;
  let pressure = 0;
  if (totalWallUsd > 0) {
    pressure = ((totalBidWallUsd - totalAskWallUsd) / totalWallUsd) * 100;
  }

  // Determine significance
  let significance: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (totalWallUsd > 5000000) significance = 'critical';
  else if (totalWallUsd > 2000000) significance = 'high';
  else if (totalWallUsd > 500000) significance = 'medium';

  return {
    bidWalls,
    askWalls,
    totalBidWallUsd,
    totalAskWallUsd,
    pressure,
    significance,
  };
}

/**
 * Detect walls on one side of the order book
 */
function detectWallsInSide(
  side: [string, string][],
  currentPrice: number,
  type: 'bid' | 'ask',
  minUsdSize: number
): Wall[] {
  const walls: Wall[] = [];

  if (side.length < 3) return walls;

  // Calculate average quantity for comparison
  const quantities = side.slice(0, 20).map(([_, qty]) => parseFloat(qty));
  const avgQuantity = quantities.reduce((a, b) => a + b, 0) / quantities.length;
  const stdDev = Math.sqrt(quantities.reduce((sum, q) => sum + Math.pow(q - avgQuantity, 2), 0) / quantities.length);
  const threshold = avgQuantity + stdDev * 1.5; // 1.5 sigma

  for (let i = 0; i < Math.min(30, side.length); i++) {
    const [priceStr, qtyStr] = side[i];
    const price = parseFloat(priceStr);
    const quantity = parseFloat(qtyStr);
    const valueUsd = price * quantity;

    // Check if this is a wall
    if (quantity > threshold && valueUsd > minUsdSize) {
      const distanceFromPrice = Math.abs(currentPrice - price) / currentPrice;

      // Only consider walls within 5% of current price
      if (distanceFromPrice < 0.05) {
        const proximityScore = Math.max(0, 100 - distanceFromPrice * 2000);

        walls.push({
          type,
          price,
          quantity,
          valueUsd,
          distanceFromPrice,
          proximityScore,
        });
      }
    }
  }

  // Sort by proximity score (closest first)
  walls.sort((a, b) => b.proximityScore - a.proximityScore);

  return walls.slice(0, 5); // Return top 5 walls
}

/**
 * Analyze wall clustering (multiple walls at similar prices)
 */
export function analyzeWallClusters(walls: Wall[], clusterThreshold: number = 0.002): Wall[][] {
  if (walls.length === 0) return [];

  const clusters: Wall[][] = [];
  const sorted = [...walls].sort((a, b) => a.price - b.price);

  let currentCluster: Wall[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevPrice = sorted[i - 1].price;
    const currPrice = sorted[i].price;
    const priceDiff = Math.abs(currPrice - prevPrice) / prevPrice;

    if (priceDiff < clusterThreshold) {
      currentCluster.push(sorted[i]);
    } else {
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }
      currentCluster = [sorted[i]];
    }
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters;
}

/**
 * Detect potential stop-hunt levels
 * Stop hunts occur when price briefly breaks through support/resistance before reversing
 */
export function detectStopHuntLevels(
  walls: Wall[],
  currentPrice: number,
  recentHigh: number,
  recentLow: number
): { level: number; probability: number; type: 'bid' | 'ask' }[] {
  const levels: { level: number; probability: number; type: 'bid' | 'ask' }[] = [];

  for (const wall of walls) {
    if (wall.type === 'bid') {
      // Bid wall below price = potential support
      if (wall.price < currentPrice) {
        // Check if price recently tested this level
        const testedRecently = recentLow < wall.price && recentLow > wall.price * 0.99;
        const probability = testedRecently ? 0.7 : 0.4;

        levels.push({
          level: wall.price,
          probability,
          type: 'bid',
        });
      }
    } else {
      // Ask wall above price = potential resistance
      if (wall.price > currentPrice) {
        // Check if price recently tested this level
        const testedRecently = recentHigh > wall.price && recentHigh < wall.price * 1.01;
        const probability = testedRecently ? 0.7 : 0.4;

        levels.push({
          level: wall.price,
          probability,
          type: 'ask',
        });
      }
    }
  }

  return levels;
}

/**
 * Calculate wall impact on price movement
 */
export function calculateWallImpact(walls: Wall[], side: 'bid' | 'ask'): number {
  const relevantWalls = walls.filter(w => w.type === side);
  if (relevantWalls.length === 0) return 0;

  // Impact = weighted sum of wall sizes and proximity
  let impact = 0;
  for (const wall of relevantWalls) {
    const sizeWeight = Math.min(1, wall.valueUsd / 1000000); // Normalize to 1M
    const proximityWeight = wall.proximityScore / 100;
    impact += sizeWeight * proximityWeight;
  }

  return Math.min(1, impact);
}
