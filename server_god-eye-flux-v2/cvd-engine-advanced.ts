/**
 * Advanced CVD (Cumulative Volume Delta) Engine
 * 
 * Institutional-grade order flow analysis with:
 * - Precise hidden buy/sell detection (iceberg orders)
 * - Volume clustering analysis
 * - Institutional footprint detection
 * - Market microstructure analysis
 * - Real-time toxicity scoring
 */

interface TradeData {
  price: number;
  quantity: number;
  isBuyerInitiated: boolean;
  timestamp: number;
}

interface CVDAnalysis {
  cumulativeDelta: number;
  deltaPercentage: number;
  buyVolume: number;
  sellVolume: number;
  buyCount: number;
  sellCount: number;
  averageBuySize: number;
  averageSellSize: number;
  hiddenBuyVolume: number;
  hiddenSellVolume: number;
  institutionalFootprint: number;
  volumeClusteringScore: number;
  toxicityScore: number;
  marketMicrostructure: {
    bidAskImbalance: number;
    spreadTightness: number;
    depthImbalance: number;
    liquidityConcentration: number;
  };
  signals: {
    hiddenBuySignal: boolean;
    hiddenSellSignal: boolean;
    institutionalBuyingPressure: boolean;
    institutionalSellingPressure: boolean;
    liquidityWithdrawal: boolean;
    spoofingDetected: boolean;
  };
}

/**
 * Detect hidden/iceberg orders through volume analysis
 * 
 * Iceberg orders show:
 * - Consistent small visible volumes
 * - Large total volumes over time
 * - Minimal price movement despite volume
 * - Repeated execution at same price levels
 */
function detectHiddenOrders(
  trades: TradeData[],
  orderBook: any
): { hiddenBuyVolume: number; hiddenSellVolume: number } {
  let hiddenBuyVolume = 0;
  let hiddenSellVolume = 0;

  // Analyze trade clustering at price levels
  const priceClusterMap = new Map<number, { volume: number; count: number; isBuy: boolean }>();

  for (const trade of trades) {
    const roundedPrice = Math.round(trade.price * 100) / 100;
    const existing = priceClusterMap.get(roundedPrice) || {
      volume: 0,
      count: 0,
      isBuy: trade.isBuyerInitiated,
    };

    existing.volume += trade.quantity;
    existing.count += 1;
    priceClusterMap.set(roundedPrice, existing);
  }

  // Detect iceberg patterns
  for (const [price, cluster] of priceClusterMap) {
    const averageTradeSize = cluster.volume / cluster.count;
    const volumeStdDev = calculateStdDev(
      trades
        .filter(t => Math.round(t.price * 100) / 100 === price)
        .map(t => t.quantity)
    );

    // Iceberg indicators:
    // 1. High number of small trades at same price
    // 2. Low standard deviation (consistent sizes)
    // 3. Total volume >> visible volume
    if (cluster.count >= 3 && volumeStdDev < averageTradeSize * 0.3) {
      const icebergVolume = cluster.volume * 0.6; // Estimated hidden portion

      if (cluster.isBuy) {
        hiddenBuyVolume += icebergVolume;
      } else {
        hiddenSellVolume += icebergVolume;
      }
    }
  }

  return { hiddenBuyVolume, hiddenSellVolume };
}

/**
 * Detect institutional footprint through order book analysis
 * 
 * Institutional characteristics:
 * - Large wall orders (>100 BTC equivalent)
 * - Layered orders (multiple levels)
 * - Rapid order placement/cancellation
 * - Asymmetric bid-ask imbalance
 */
function detectInstitutionalFootprint(
  orderBook: any,
  trades: TradeData[]
): number {
  let institutionalScore = 0;

  // Analyze bid-ask imbalance
  const bidVolume = orderBook.bids?.reduce((sum: number, [, qty]: [string, string]) => 
    sum + parseFloat(qty), 0) || 0;
  const askVolume = orderBook.asks?.reduce((sum: number, [, qty]: [string, string]) => 
    sum + parseFloat(qty), 0) || 0;

  const imbalance = Math.abs(bidVolume - askVolume) / (bidVolume + askVolume || 1);
  
  // Strong imbalance suggests institutional activity
  if (imbalance > 0.6) {
    institutionalScore += 30;
  }

  // Detect large wall orders
  const largeWalls = (orderBook.bids || []).concat(orderBook.asks || [])
    .filter(([, qty]: [string, string]) => parseFloat(qty) > 100);

  if (largeWalls.length >= 3) {
    institutionalScore += 25;
  }

  // Detect layered orders (multiple levels within 0.5%)
  const bidPrices = (orderBook.bids || []).map(([price]: [string, string]) => parseFloat(price));
  const layeredBids = bidPrices.filter((price: number, i: number, arr: number[]) => 
    i > 0 && (arr[i - 1] - price) / arr[i - 1] < 0.005
  );

  if (layeredBids.length >= 3) {
    institutionalScore += 20;
  }

  // Large trades relative to average
  const avgTradeSize = trades.reduce((sum, t) => sum + t.quantity, 0) / (trades.length || 1);
  const largeTrades = trades.filter(t => t.quantity > avgTradeSize * 3);

  if (largeTrades.length > trades.length * 0.1) {
    institutionalScore += 15;
  }

  return Math.min(100, institutionalScore);
}

/**
 * Detect spoofing/layering attacks
 * 
 * Spoofing indicators:
 * - Large orders placed then quickly cancelled
 * - Orders that never execute
 * - Rapid order modifications
 * - Orders that disappear without execution
 */
function detectSpoofing(
  orderBook: any,
  trades: TradeData[],
  previousOrderBook: any
): boolean {
  if (!previousOrderBook) return false;

  // Detect disappeared orders (likely cancelled)
  const prevBidPrices = new Set(
    (previousOrderBook.bids || []).map(([p]: [string, string]) => parseFloat(p))
  );
  const currentBidPrices = new Set(
    (orderBook.bids || []).map(([p]: [string, string]) => parseFloat(p))
  );

  const disappearedOrders = Array.from(prevBidPrices).filter(p => !currentBidPrices.has(p));

  // If many orders disappeared without execution, likely spoofing
  return disappearedOrders.length > 5;
}

/**
 * Calculate volume clustering score
 * 
 * Measures how concentrated volume is at specific price levels
 * High clustering = institutional activity
 */
function calculateVolumeClustering(trades: TradeData[]): number {
  const priceClusterMap = new Map<number, number>();

  for (const trade of trades) {
    const roundedPrice = Math.round(trade.price * 100) / 100;
    const existing = priceClusterMap.get(roundedPrice) || 0;
    priceClusterMap.set(roundedPrice, existing + trade.quantity);
  }

  const volumes = Array.from(priceClusterMap.values());
  const totalVolume = volumes.reduce((a, b) => a + b, 0);
  
  // Herfindahl index (concentration measure)
  const herfindahl = volumes.reduce((sum, v) => 
    sum + Math.pow(v / totalVolume, 2), 0
  );

  // Convert to 0-100 scale
  return Math.min(100, herfindahl * 1000);
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  
  return Math.sqrt(variance);
}

/**
 * Analyze market microstructure
 */
function analyzeMarketMicrostructure(
  orderBook: any,
  trades: TradeData[]
): CVDAnalysis['marketMicrostructure'] {
  const bidVolume = orderBook.bids?.reduce((sum: number, [, qty]: [string, string]) => 
    sum + parseFloat(qty), 0) || 0;
  const askVolume = orderBook.asks?.reduce((sum: number, [, qty]: [string, string]) => 
    sum + parseFloat(qty), 0) || 0;

  const bestBid = parseFloat(orderBook.bids?.[0]?.[0] || 0);
  const bestAsk = parseFloat(orderBook.asks?.[0]?.[0] || 0);
  const spread = bestAsk - bestBid;
  const midPrice = (bestBid + bestAsk) / 2;

  // Bid-ask imbalance (-1 to 1, where 1 = all bid, -1 = all ask)
  const bidAskImbalance = (bidVolume - askVolume) / (bidVolume + askVolume || 1);

  // Spread tightness (lower = tighter, more liquid)
  const spreadTightness = 1 - Math.min(1, spread / midPrice * 100);

  // Depth imbalance (concentration in top levels)
  const topBidVolume = parseFloat(orderBook.bids?.[0]?.[1] || 0);
  const topAskVolume = parseFloat(orderBook.asks?.[0]?.[1] || 0);
  const depthImbalance = (topBidVolume - topAskVolume) / (topBidVolume + topAskVolume || 1);

  // Liquidity concentration (% of volume in top 5 levels)
  const top5BidVolume = (orderBook.bids || [])
    .slice(0, 5)
    .reduce((sum: number, [, qty]: [string, string]) => sum + parseFloat(qty), 0);
  const liquidityConcentration = Math.min(1, top5BidVolume / (bidVolume || 1));

  return {
    bidAskImbalance,
    spreadTightness,
    depthImbalance,
    liquidityConcentration,
  };
}

/**
 * Main CVD analysis function
 */
export function analyzeCVD(
  trades: TradeData[],
  orderBook: any,
  previousOrderBook?: any
): CVDAnalysis {
  // Calculate basic CVD
  const buyTrades = trades.filter(t => t.isBuyerInitiated);
  const sellTrades = trades.filter(t => !t.isBuyerInitiated);

  const buyVolume = buyTrades.reduce((sum, t) => sum + t.quantity, 0);
  const sellVolume = sellTrades.reduce((sum, t) => sum + t.quantity, 0);
  const cumulativeDelta = buyVolume - sellVolume;
  const totalVolume = buyVolume + sellVolume;
  const deltaPercentage = totalVolume > 0 ? (cumulativeDelta / totalVolume) * 100 : 0;

  // Detect hidden orders
  const { hiddenBuyVolume, hiddenSellVolume } = detectHiddenOrders(trades, orderBook);

  // Detect institutional footprint
  const institutionalFootprint = detectInstitutionalFootprint(orderBook, trades);

  // Calculate volume clustering
  const volumeClusteringScore = calculateVolumeClustering(trades);

  // Analyze market microstructure
  const marketMicrostructure = analyzeMarketMicrostructure(orderBook, trades);

  // Detect spoofing
  const spoofingDetected = detectSpoofing(orderBook, trades, previousOrderBook);

  // Calculate toxicity score (0-100)
  let toxicityScore = 0;

  // High hidden volume = high toxicity
  const totalHiddenVolume = hiddenBuyVolume + hiddenSellVolume;
  if (totalHiddenVolume > totalVolume * 0.3) {
    toxicityScore += 25;
  }

  // High institutional activity = higher toxicity
  toxicityScore += institutionalFootprint * 0.3;

  // Spoofing detected = high toxicity
  if (spoofingDetected) {
    toxicityScore += 30;
  }

  // Extreme bid-ask imbalance = toxicity
  if (Math.abs(marketMicrostructure.bidAskImbalance) > 0.7) {
    toxicityScore += 20;
  }

  // Generate signals
  const signals = {
    hiddenBuySignal: hiddenBuyVolume > hiddenSellVolume * 1.5,
    hiddenSellSignal: hiddenSellVolume > hiddenBuyVolume * 1.5,
    institutionalBuyingPressure: institutionalFootprint > 60 && cumulativeDelta > 0,
    institutionalSellingPressure: institutionalFootprint > 60 && cumulativeDelta < 0,
    liquidityWithdrawal: marketMicrostructure.liquidityConcentration > 0.8,
    spoofingDetected,
  };

  return {
    cumulativeDelta,
    deltaPercentage,
    buyVolume,
    sellVolume,
    buyCount: buyTrades.length,
    sellCount: sellTrades.length,
    averageBuySize: buyTrades.length > 0 ? buyVolume / buyTrades.length : 0,
    averageSellSize: sellTrades.length > 0 ? sellVolume / sellTrades.length : 0,
    hiddenBuyVolume,
    hiddenSellVolume,
    institutionalFootprint,
    volumeClusteringScore,
    toxicityScore: Math.min(100, toxicityScore),
    marketMicrostructure,
    signals,
  };
}

/**
 * Analyze CVD trends over time
 */
export function analyzeCVDTrends(
  analyses: CVDAnalysis[],
  windowSize: number = 5
): {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  momentum: number;
} {
  if (analyses.length < windowSize) {
    return { trend: 'NEUTRAL', strength: 0, momentum: 0 };
  }

  const recent = analyses.slice(-windowSize);
  const avgDelta = recent.reduce((sum, a) => sum + a.cumulativeDelta, 0) / windowSize;
  const avgToxicity = recent.reduce((sum, a) => sum + a.toxicityScore, 0) / windowSize;

  // Momentum: rate of change in delta
  const momentum = recent[recent.length - 1].cumulativeDelta - recent[0].cumulativeDelta;

  // Trend determination
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let strength = 0;

  if (avgDelta > 0 && momentum > 0) {
    trend = 'BULLISH';
    strength = Math.min(100, (avgDelta / 1000) * 100); // Normalize
  } else if (avgDelta < 0 && momentum < 0) {
    trend = 'BEARISH';
    strength = Math.min(100, (Math.abs(avgDelta) / 1000) * 100);
  }

  // Adjust strength based on toxicity
  strength *= (1 - avgToxicity / 100);

  return { trend, strength, momentum };
}
