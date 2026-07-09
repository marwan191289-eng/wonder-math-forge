/**
 * Advanced VPIN (Volume-Synchronized Probability of Informed Trading) Engine
 * Sophisticated algorithms for toxicity metrics, informed trading detection, and market microstructure analysis
 */

export interface AdvancedVPIN {
  vpin: number;
  toxicity: number;
  informedTradingProbability: number;
  confidenceScore: number;
  volumeSynchronization: number;
  buyPressure: number;
  sellPressure: number;
  institutionalActivity: number;
  marketMicrostructure: MarketMicrostructure;
  signals: TradingSignal[];
  reasoning: string;
}

export interface MarketMicrostructure {
  bidAskSpread: number;
  spreadTightness: number;
  depthImbalance: number;
  volumeImbalance: number;
  priceImpact: number;
}

export interface TradingSignal {
  type: "informed_buy" | "informed_sell" | "toxic_flow" | "institutional_accumulation";
  strength: number;
  confidence: number;
  description: string;
}

type OrderBook = any;
type Kline = any;

function calculateVolumeSynchronization(orderBooks: OrderBook[], klines: Kline[]): number {
  if (orderBooks.length === 0 || klines.length === 0) return 0;
  const currentVolume = Number(klines[klines.length - 1].volume);
  const avgVolume = klines.slice(-20).reduce((sum, k) => sum + Number(k.volume), 0) / 20;
  const volumeConcentration = currentVolume / avgVolume;
  const synchronization = Math.min(100, (volumeConcentration / 2) * 100);
  return Math.round(synchronization);
}

function calculateOrderFlowPressure(orderBooks: OrderBook[]): { buyPressure: number; sellPressure: number } {
  if (orderBooks.length === 0) return { buyPressure: 50, sellPressure: 50 };
  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  for (const ob of orderBooks) {
    if (ob.bids && Array.isArray(ob.bids)) {
      for (const [price, volume] of ob.bids) {
        totalBuyVolume += Number(volume);
      }
    }
    if (ob.asks && Array.isArray(ob.asks)) {
      for (const [price, volume] of ob.asks) {
        totalSellVolume += Number(volume);
      }
    }
  }
  const totalVolume = totalBuyVolume + totalSellVolume;
  if (totalVolume === 0) return { buyPressure: 50, sellPressure: 50 };
  const buyPressure = (totalBuyVolume / totalVolume) * 100;
  const sellPressure = (totalSellVolume / totalVolume) * 100;
  return {
    buyPressure: Math.round(buyPressure),
    sellPressure: Math.round(sellPressure),
  };
}

function calculateMarketMicrostructure(orderBooks: OrderBook[]): MarketMicrostructure {
  if (orderBooks.length === 0) {
    return {
      bidAskSpread: 0,
      spreadTightness: 0,
      depthImbalance: 0,
      volumeImbalance: 0,
      priceImpact: 0,
    };
  }
  const ob = orderBooks[orderBooks.length - 1];
  const bestBid = ob.bids?.[0]?.[0] ? Number(ob.bids[0][0]) : 0;
  const bestAsk = ob.asks?.[0]?.[0] ? Number(ob.asks[0][0]) : 0;
  if (bestBid === 0 || bestAsk === 0) {
    return {
      bidAskSpread: 0,
      spreadTightness: 0,
      depthImbalance: 0,
      volumeImbalance: 0,
      priceImpact: 0,
    };
  }
  const bidAskSpread = bestAsk - bestBid;
  const midPrice = (bestBid + bestAsk) / 2;
  const spreadPercentage = (bidAskSpread / midPrice) * 100;
  const spreadTightness = Math.max(0, 100 - spreadPercentage * 1000);
  const bidVolume = ob.bids?.reduce((sum: number, [_, vol]: [any, any]) => sum + Number(vol), 0) || 0;
  const askVolume = ob.asks?.reduce((sum: number, [_, vol]: [any, any]) => sum + Number(vol), 0) || 0;
  const totalDepth = bidVolume + askVolume;
  const depthImbalance = totalDepth > 0 ? ((bidVolume - askVolume) / totalDepth) * 100 : 0;
  const topBidVolume = ob.bids?.slice(0, 5).reduce((sum: number, [_, vol]: [any, any]) => sum + Number(vol), 0) || 0;
  const topAskVolume = ob.asks?.slice(0, 5).reduce((sum: number, [_, vol]: [any, any]) => sum + Number(vol), 0) || 0;
  const topTotalVolume = topBidVolume + topAskVolume;
  const volumeImbalance = topTotalVolume > 0 ? ((topBidVolume - topAskVolume) / topTotalVolume) * 100 : 0;
  const priceImpact = spreadTightness > 80 ? 20 : spreadTightness > 60 ? 40 : 60;
  return {
    bidAskSpread: Math.round(bidAskSpread * 100000) / 100000,
    spreadTightness: Math.round(spreadTightness),
    depthImbalance: Math.round(depthImbalance),
    volumeImbalance: Math.round(volumeImbalance),
    priceImpact: Math.round(priceImpact),
  };
}

function detectInstitutionalActivity(orderBooks: OrderBook[], klines: Kline[], microstructure: MarketMicrostructure): number {
  let institutionalScore = 0;
  if (klines.length > 0) {
    const currentVolume = Number(klines[klines.length - 1].volume);
    const avgVolume = klines.slice(-20).reduce((sum, k) => sum + Number(k.volume), 0) / 20;
    if (currentVolume > avgVolume * 2) {
      institutionalScore += 30;
    }
  }
  if (microstructure.spreadTightness > 80) {
    institutionalScore += 25;
  }
  if (Math.abs(microstructure.depthImbalance) > 60) {
    institutionalScore += 25;
  }
  if (Math.abs(microstructure.volumeImbalance) > 50) {
    institutionalScore += 20;
  }
  return Math.min(100, institutionalScore);
}

function generateSignals(vpin: number, toxicity: number, buyPressure: number, sellPressure: number, institutionalActivity: number): TradingSignal[] {
  const signals: TradingSignal[] = [];
  if (vpin > 70) {
    if (buyPressure > 60) {
      signals.push({
        type: "informed_buy",
        strength: Math.min(100, vpin - 50),
        confidence: Math.min(100, (vpin / 100) * 100),
        description: `High probability informed buying detected (VPIN: ${vpin.toFixed(0)})`,
      });
    } else if (sellPressure > 60) {
      signals.push({
        type: "informed_sell",
        strength: Math.min(100, vpin - 50),
        confidence: Math.min(100, (vpin / 100) * 100),
        description: `High probability informed selling detected (VPIN: ${vpin.toFixed(0)})`,
      });
    }
  }
  if (toxicity > 75) {
    signals.push({
      type: "toxic_flow",
      strength: toxicity - 50,
      confidence: Math.min(100, (toxicity / 100) * 100),
      description: `Toxic order flow detected (Toxicity: ${toxicity.toFixed(0)})`,
    });
  }
  if (institutionalActivity > 70 && buyPressure > 55) {
    signals.push({
      type: "institutional_accumulation",
      strength: institutionalActivity - 50,
      confidence: Math.min(100, (institutionalActivity / 100) * 100),
      description: `Institutional accumulation pattern detected`,
    });
  }
  return signals;
}

export function calculateAdvancedVPIN(orderBooks: OrderBook[], klines: Kline[]): AdvancedVPIN {
  if (orderBooks.length === 0 || klines.length === 0) {
    return {
      vpin: 0,
      toxicity: 0,
      informedTradingProbability: 0,
      confidenceScore: 0,
      volumeSynchronization: 0,
      buyPressure: 50,
      sellPressure: 50,
      institutionalActivity: 0,
      marketMicrostructure: {
        bidAskSpread: 0,
        spreadTightness: 0,
        depthImbalance: 0,
        volumeImbalance: 0,
        priceImpact: 0,
      },
      signals: [],
      reasoning: "Insufficient data for VPIN analysis",
    };
  }
  const volumeSynchronization = calculateVolumeSynchronization(orderBooks, klines);
  const { buyPressure, sellPressure } = calculateOrderFlowPressure(orderBooks);
  const microstructure = calculateMarketMicrostructure(orderBooks);
  const institutionalActivity = detectInstitutionalActivity(orderBooks, klines, microstructure);
  const pressureDifference = Math.abs(buyPressure - sellPressure);
  const vpin = Math.min(100, (pressureDifference * volumeSynchronization) / 100);
  const spreadToxicity = 100 - microstructure.spreadTightness;
  const imbalanceToxicity = Math.abs(microstructure.depthImbalance);
  const toxicity = Math.min(100, (spreadToxicity + imbalanceToxicity) / 2);
  const informedTradingProbability = Math.min(100, (vpin + institutionalActivity) / 2);
  const confidenceScore = Math.min(100, (volumeSynchronization + microstructure.spreadTightness) / 2);
  const signals = generateSignals(vpin, toxicity, buyPressure, sellPressure, institutionalActivity);
  let reasoning = "";
  if (vpin > 70 && toxicity < 40) {
    reasoning = `Strong informed trading signal. VPIN: ${vpin.toFixed(0)}, Clean order flow (Toxicity: ${toxicity.toFixed(0)})`;
  } else if (toxicity > 70) {
    reasoning = `High order flow toxicity. Market microstructure deteriorating.`;
  } else if (institutionalActivity > 70) {
    reasoning = `Significant institutional activity detected.`;
  } else {
    reasoning = `Normal market conditions. VPIN: ${vpin.toFixed(0)}, Toxicity: ${toxicity.toFixed(0)}`;
  }
  return {
    vpin: Math.round(vpin),
    toxicity: Math.round(toxicity),
    informedTradingProbability: Math.round(informedTradingProbability),
    confidenceScore: Math.round(confidenceScore),
    volumeSynchronization,
    buyPressure,
    sellPressure,
    institutionalActivity,
    marketMicrostructure: microstructure,
    signals,
    reasoning,
  };
}
