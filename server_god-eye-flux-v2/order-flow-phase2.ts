/**
 * Order Flow Engine Phase 2 - Institutional Footprint Detection
 * 
 * Advanced microstructure analysis for detecting:
 * - Institutional order clusters and footprints
 * - Spoofing and layering patterns
 * - Hidden liquidity and iceberg orders
 * - Market maker activity
 * - Predatory trading signals
 */

export interface InstitutionalFootprint {
  footprintScore: number; // 0-100, higher = stronger institutional presence
  footprintType: 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | 'SPOOFING' | 'LAYERING';
  confidenceLevel: number; // 0-100
  clusterDensity: number; // Number of order clusters detected
  layerCount: number; // Number of layered orders detected
  spoofingRisk: number; // 0-100, risk of spoofing activity
  hiddenLiquidityEstimate: number; // Estimated volume not visible on order book
  marketMakerActivity: number; // 0-100, MM presence indicator
  predatorySignals: PredatorySignal[];
  reasoning: string;
}

export interface PredatorySignal {
  type: 'SPOOFING' | 'LAYERING' | 'QUOTE_STUFFING' | 'PUMP_AND_DUMP' | 'WASH_TRADING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number; // 0-100
  description: string;
  priceLevel: number;
  volumeInvolved: number;
}

export interface OrderCluster {
  priceLevel: number;
  totalVolume: number;
  orderCount: number;
  timeSpan: number; // ms between first and last order
  isLayered: boolean;
  layerDepth: number; // How many layers detected
  isIceberg: boolean;
  estimatedRealVolume: number;
}

/**
 * Detect institutional footprints in order book
 * Identifies clusters, layers, and hidden orders
 */
export function detectInstitutionalFootprint(
  orderBook: {
    bids: Array<[number, number]>; // [price, volume]
    asks: Array<[number, number]>;
  },
  recentTrades: Array<{
    price: number;
    quantity: number;
    time: number;
    isBuyerMaker: boolean;
  }>,
  priceHistory: number[] // Last 50 prices for pattern detection
): InstitutionalFootprint {
  // Detect order clusters
  const bidClusters = detectOrderClusters(orderBook.bids);
  const askClusters = detectOrderClusters(orderBook.asks);
  
  // Detect layering patterns
  const layeringScore = detectLayeringPatterns(orderBook);
  
  // Detect spoofing signals
  const spoofingScore = detectSpoofingPatterns(orderBook, recentTrades);
  
  // Detect hidden liquidity
  const hiddenLiquidity = estimateHiddenLiquidity(orderBook, recentTrades);
  
  // Detect market maker activity
  const mmActivity = detectMarketMakerActivity(orderBook, recentTrades);
  
  // Detect predatory signals
  const predatorySignals = detectPredatorySignals(orderBook, recentTrades, priceHistory);
  
  // Determine footprint type
  const footprintType = determineFootprintType(
    bidClusters,
    askClusters,
    layeringScore,
    spoofingScore,
    recentTrades
  );
  
  // Calculate overall footprint score
  const footprintScore = calculateFootprintScore(
    bidClusters,
    askClusters,
    layeringScore,
    spoofingScore,
    mmActivity,
    predatorySignals
  );
  
  return {
    footprintScore,
    footprintType,
    confidenceLevel: Math.min(100, footprintScore * 0.8 + mmActivity * 0.2),
    clusterDensity: bidClusters.length + askClusters.length,
    layerCount: bidClusters.filter(c => c.isLayered).length + askClusters.filter(c => c.isLayered).length,
    spoofingRisk: spoofingScore,
    hiddenLiquidityEstimate: hiddenLiquidity,
    marketMakerActivity: mmActivity,
    predatorySignals,
    reasoning: generateFootprintReasoning(footprintType, footprintScore, spoofingScore, layeringScore),
  };
}

/**
 * Detect order clusters at specific price levels
 */
function detectOrderClusters(orders: Array<[number, number]>): OrderCluster[] {
  if (orders.length === 0) return [];
  
  const clusters: OrderCluster[] = [];
  const priceGrouping = 0.01; // Group orders within 0.01% price range
  
  let currentCluster: Array<[number, number]> | null = null;
  let clusterStart = 0;
  
  for (let i = 0; i < orders.length; i++) {
    const [price, volume] = orders[i];
    
    if (!currentCluster) {
      currentCluster = [[price, volume]];
      clusterStart = i;
    } else {
      const lastPrice = currentCluster[currentCluster.length - 1][0];
      const priceDiff = Math.abs(price - lastPrice) / lastPrice;
      
      if (priceDiff < priceGrouping) {
        currentCluster.push([price, volume]);
      } else {
        // Finalize current cluster
        if (currentCluster.length > 0) {
          clusters.push(analyzeCluster(currentCluster));
        }
        currentCluster = [[price, volume]];
        clusterStart = i;
      }
    }
  }
  
  // Add final cluster
  if (currentCluster && currentCluster.length > 0) {
    clusters.push(analyzeCluster(currentCluster));
  }
  
  return clusters.sort((a, b) => b.totalVolume - a.totalVolume).slice(0, 10);
}

/**
 * Analyze a single order cluster
 */
function analyzeCluster(orders: Array<[number, number]>): OrderCluster {
  const totalVolume = orders.reduce((sum, [_, vol]) => sum + vol, 0);
  const avgPrice = orders.reduce((sum, [price]) => sum + price, 0) / orders.length;
  
  // Detect layering: multiple orders at same price with similar sizes
  const priceGroups = new Map<number, number[]>();
  for (const [price, volume] of orders) {
    if (!priceGroups.has(price)) {
      priceGroups.set(price, []);
    }
    priceGroups.get(price)!.push(volume);
  }
  
  let layerDepth = 0;
  let isLayered = false;
  for (const volumes of priceGroups.values()) {
    if (volumes.length > 1) {
      // Check if volumes are similar (within 20%)
      const avgVol = volumes.reduce((a, b) => a + b) / volumes.length;
      const similarVols = volumes.filter(v => Math.abs(v - avgVol) / avgVol < 0.2);
      if (similarVols.length > 1) {
        isLayered = true;
        layerDepth = Math.max(layerDepth, similarVols.length);
      }
    }
  }
  
  // Detect iceberg orders: sudden volume drop at certain price levels
  const isIceberg = detectIcebergPattern(orders);
  
  return {
    priceLevel: avgPrice,
    totalVolume,
    orderCount: orders.length,
    timeSpan: 0, // Would need timestamp data
    isLayered,
    layerDepth,
    isIceberg,
    estimatedRealVolume: isIceberg ? totalVolume * 2 : totalVolume,
  };
}

/**
 * Detect layering patterns (multiple orders at same price)
 */
function detectLayeringPatterns(orderBook: { bids: Array<[number, number]>; asks: Array<[number, number]> }): number {
  let layeringScore = 0;
  
  // Check bid side
  const bidPrices = new Map<number, number>();
  for (const [price, volume] of orderBook.bids) {
    const rounded = Math.round(price * 100) / 100;
    bidPrices.set(rounded, (bidPrices.get(rounded) || 0) + volume);
  }
  
  // Count prices with multiple orders
  let bidLayerCount = 0;
  for (const volume of bidPrices.values()) {
    if (volume > 0) bidLayerCount++;
  }
  
  // Similar for asks
  const askPrices = new Map<number, number>();
  for (const [price, volume] of orderBook.asks) {
    const rounded = Math.round(price * 100) / 100;
    askPrices.set(rounded, (askPrices.get(rounded) || 0) + volume);
  }
  
  let askLayerCount = 0;
  for (const volume of askPrices.values()) {
    if (volume > 0) askLayerCount++;
  }
  
  // High layer count = potential layering
  const maxLayers = Math.max(bidLayerCount, askLayerCount);
  layeringScore = Math.min(100, (maxLayers / 20) * 100);
  
  return layeringScore;
}

/**
 * Detect spoofing patterns (orders placed and cancelled)
 */
function detectSpoofingPatterns(
  orderBook: { bids: Array<[number, number]>; asks: Array<[number, number]> },
  recentTrades: Array<{ price: number; quantity: number; time: number; isBuyerMaker: boolean }>
): number {
  let spoofingScore = 0;
  
  // Spoofing indicators:
  // 1. Large orders that never get filled
  // 2. Orders that disappear when price moves
  // 3. Orders on opposite side of market
  
  const topBid = orderBook.bids[0]?.[0] ?? 0;
  const topAsk = orderBook.asks[0]?.[0] ?? 0;
  
  // Check for large orders far from mid
  const largeOrders = [
    ...orderBook.bids.filter(([price, vol]) => vol > 100 && price < topBid * 0.98),
    ...orderBook.asks.filter(([price, vol]) => vol > 100 && price > topAsk * 1.02),
  ];
  
  if (largeOrders.length > 0) {
    spoofingScore += 20;
  }
  
  // Check for sudden order book changes
  const recentTradeVolume = recentTrades
    .filter(t => Date.now() - t.time < 5000)
    .reduce((sum, t) => sum + t.quantity, 0);
  
  const totalBookVolume = [
    ...orderBook.bids.map(([_, v]) => v),
    ...orderBook.asks.map(([_, v]) => v),
  ].reduce((a, b) => a + b, 0);
  
  if (recentTradeVolume > totalBookVolume * 0.5) {
    spoofingScore += 15;
  }
  
  return Math.min(100, spoofingScore);
}

/**
 * Estimate hidden liquidity (iceberg orders, dark pools)
 */
function estimateHiddenLiquidity(
  orderBook: { bids: Array<[number, number]>; asks: Array<[number, number]> },
  recentTrades: Array<{ price: number; quantity: number; time: number; isBuyerMaker: boolean }>
): number {
  // Hidden liquidity estimate based on:
  // 1. Trades that don't match visible order book
  // 2. Sudden order book changes
  // 3. Large trades with small visible orders
  
  let hiddenVolume = 0;
  
  for (const trade of recentTrades.slice(-20)) {
    // Check if trade price is between bid/ask
    const topBid = orderBook.bids[0]?.[0] ?? 0;
    const topAsk = orderBook.asks[0]?.[0] ?? 0;
    
    if (trade.price > topBid && trade.price < topAsk) {
      // Trade happened inside spread - likely hidden order
      hiddenVolume += trade.quantity * 0.5;
    }
  }
  
  return hiddenVolume;
}

/**
 * Detect market maker activity
 */
function detectMarketMakerActivity(
  orderBook: { bids: Array<[number, number]>; asks: Array<[number, number]> },
  recentTrades: Array<{ price: number; quantity: number; time: number; isBuyerMaker: boolean }>
): number {
  let mmScore = 0;
  
  // MM indicators:
  // 1. Balanced bid/ask volumes
  // 2. Consistent order book depth
  // 3. Frequent small trades
  
  const totalBidVol = orderBook.bids.reduce((sum, [_, v]) => sum + v, 0);
  const totalAskVol = orderBook.asks.reduce((sum, [_, v]) => sum + v, 0);
  
  const balance = Math.abs(totalBidVol - totalAskVol) / Math.max(totalBidVol, totalAskVol);
  if (balance < 0.3) mmScore += 30; // Well-balanced = MM activity
  
  // Check trade frequency
  const recentTradeCount = recentTrades.filter(t => Date.now() - t.time < 10000).length;
  if (recentTradeCount > 50) mmScore += 40;
  
  // Check for consistent order book
  if (orderBook.bids.length > 10 && orderBook.asks.length > 10) {
    mmScore += 30;
  }
  
  return Math.min(100, mmScore);
}

/**
 * Detect predatory trading signals
 */
function detectPredatorySignals(
  orderBook: { bids: Array<[number, number]>; asks: Array<[number, number]> },
  recentTrades: Array<{ price: number; quantity: number; time: number; isBuyerMaker: boolean }>,
  priceHistory: number[]
): PredatorySignal[] {
  const signals: PredatorySignal[] = [];
  
  // Detect quote stuffing: rapid order placement and cancellation
  const rapidOrders = recentTrades.filter(t => Date.now() - t.time < 1000);
  if (rapidOrders.length > 20) {
    signals.push({
      type: 'QUOTE_STUFFING',
      severity: 'HIGH',
      confidence: Math.min(100, (rapidOrders.length / 10) * 100),
      description: 'Rapid order placement detected - possible quote stuffing',
      priceLevel: orderBook.bids[0]?.[0] ?? 0,
      volumeInvolved: rapidOrders.reduce((sum, t) => sum + t.quantity, 0),
    });
  }
  
  // Detect spoofing: large orders that disappear
  const largeOrders = [
    ...orderBook.bids.filter(([_, v]) => v > 500),
    ...orderBook.asks.filter(([_, v]) => v > 500),
  ];
  
  if (largeOrders.length > 5) {
    signals.push({
      type: 'SPOOFING',
      severity: 'MEDIUM',
      confidence: 65,
      description: 'Multiple large orders detected - possible spoofing',
      priceLevel: orderBook.bids[0]?.[0] ?? 0,
      volumeInvolved: largeOrders.reduce((sum, [_, v]) => sum + v, 0),
    });
  }
  
  // Detect pump and dump: sudden price spike with volume
  if (priceHistory.length > 5) {
    const priceChange = (priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0];
    const recentVolume = recentTrades
      .filter(t => Date.now() - t.time < 5000)
      .reduce((sum, t) => sum + t.quantity, 0);
    
    if (priceChange > 0.05 && recentVolume > 1000) {
      signals.push({
        type: 'PUMP_AND_DUMP',
        severity: 'HIGH',
        confidence: 75,
        description: `Price spike +${(priceChange * 100).toFixed(1)}% with high volume`,
        priceLevel: priceHistory[priceHistory.length - 1],
        volumeInvolved: recentVolume,
      });
    }
  }
  
  return signals;
}

/**
 * Detect iceberg order pattern
 */
function detectIcebergPattern(orders: Array<[number, number]>): boolean {
  if (orders.length < 3) return false;
  
  // Iceberg: visible portion is small, but orders keep appearing at same price
  const volumes = orders.map(([_, v]) => v);
  const avgVolume = volumes.reduce((a, b) => a + b) / volumes.length;
  const variance = volumes.reduce((sum, v) => sum + Math.pow(v - avgVolume, 2), 0) / volumes.length;
  
  // High variance with consistent price = iceberg
  return Math.sqrt(variance) > avgVolume * 0.5;
}

/**
 * Determine footprint type
 */
function determineFootprintType(
  bidClusters: OrderCluster[],
  askClusters: OrderCluster[],
  layeringScore: number,
  spoofingScore: number,
  recentTrades: Array<{ price: number; quantity: number; time: number; isBuyerMaker: boolean }>
): 'ACCUMULATION' | 'DISTRIBUTION' | 'NEUTRAL' | 'SPOOFING' | 'LAYERING' {
  if (spoofingScore > 60) return 'SPOOFING';
  if (layeringScore > 60) return 'LAYERING';
  
  // Check buy vs sell pressure
  const buyVolume = recentTrades
    .filter(t => !t.isBuyerMaker && Date.now() - t.time < 10000)
    .reduce((sum, t) => sum + t.quantity, 0);
  
  const sellVolume = recentTrades
    .filter(t => t.isBuyerMaker && Date.now() - t.time < 10000)
    .reduce((sum, t) => sum + t.quantity, 0);
  
  if (buyVolume > sellVolume * 1.5) return 'ACCUMULATION';
  if (sellVolume > buyVolume * 1.5) return 'DISTRIBUTION';
  
  return 'NEUTRAL';
}

/**
 * Calculate overall footprint score
 */
function calculateFootprintScore(
  bidClusters: OrderCluster[],
  askClusters: OrderCluster[],
  layeringScore: number,
  spoofingScore: number,
  mmActivity: number,
  predatorySignals: PredatorySignal[]
): number {
  let score = 0;
  
  // Cluster density (0-30 points)
  const clusterDensity = bidClusters.length + askClusters.length;
  score += Math.min(30, (clusterDensity / 10) * 30);
  
  // Layering (0-20 points)
  score += (layeringScore / 100) * 20;
  
  // Spoofing risk (0-20 points)
  score += (spoofingScore / 100) * 20;
  
  // Market maker activity (0-20 points)
  score += (mmActivity / 100) * 20;
  
  // Predatory signals (0-10 points)
  const criticalSignals = predatorySignals.filter(s => s.severity === 'CRITICAL').length;
  score += Math.min(10, criticalSignals * 5);
  
  return Math.min(100, score);
}

/**
 * Generate reasoning for footprint analysis
 */
function generateFootprintReasoning(
  footprintType: string,
  footprintScore: number,
  spoofingScore: number,
  layeringScore: number
): string {
  const reasons: string[] = [];
  
  reasons.push(`Footprint Type: ${footprintType}`);
  
  if (footprintScore > 70) {
    reasons.push('Strong institutional presence detected');
  }
  
  if (spoofingScore > 60) {
    reasons.push('⚠️ High spoofing risk - large orders may be fake');
  }
  
  if (layeringScore > 60) {
    reasons.push('⚠️ Layering pattern detected - multiple orders at similar prices');
  }
  
  return reasons.join(' · ');
}
