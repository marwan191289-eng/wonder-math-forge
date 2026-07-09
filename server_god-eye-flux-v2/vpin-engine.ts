import type { OrderBook } from "../drizzle/schema";

export interface VPINMetrics {
  vpin: number; // 0-100, higher = more informed trading
  buyVolume: number;
  sellVolume: number;
  volumeDelta: number;
  toxicity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  informedTradingProbability: number; // 0-100
  reasoning: string;
}

export function calculateVPIN(orderBooks: OrderBook[]): VPINMetrics {
  if (orderBooks.length < 2) {
    return {
      vpin: 0,
      buyVolume: 0,
      sellVolume: 0,
      volumeDelta: 0,
      toxicity: "LOW",
      informedTradingProbability: 0,
      reasoning: "Insufficient order book data for VPIN calculation",
    };
  }

  // Use last 20 order book snapshots for VPIN window
  const window = orderBooks.slice(-20);
  let totalBuyVolume = 0;
  let totalSellVolume = 0;

  // Calculate buy/sell volume from each order book snapshot
  for (const ob of window) {
    totalBuyVolume += Number(ob.bidVolume);
    totalSellVolume += Number(ob.askVolume);
  }

  // Calculate volume delta
  const volumeDelta = totalBuyVolume - totalSellVolume;
  const totalVolume = totalBuyVolume + totalSellVolume;

  // VPIN calculation: ratio of volume delta to total volume
  // Higher VPIN indicates more informed trading (directional bias)
  let vpin = 0;
  if (totalVolume > 0) {
    vpin = Math.abs(volumeDelta) / totalVolume;
    vpin = Math.min(100, vpin * 100); // Scale to 0-100
  }

  // Determine toxicity level
  let toxicity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  let informedTradingProbability = 0;

  if (vpin < 20) {
    toxicity = "LOW";
    informedTradingProbability = 10;
  } else if (vpin < 40) {
    toxicity = "MEDIUM";
    informedTradingProbability = 35;
  } else if (vpin < 60) {
    toxicity = "HIGH";
    informedTradingProbability = 65;
  } else {
    toxicity = "CRITICAL";
    informedTradingProbability = 85;
  }

  // Generate reasoning
  let reasoning = "";
  if (volumeDelta > 0) {
    reasoning = `Bullish bias detected: ${Math.round(informedTradingProbability)}% probability of informed buying. VPIN: ${Math.round(vpin)}`;
  } else if (volumeDelta < 0) {
    reasoning = `Bearish bias detected: ${Math.round(informedTradingProbability)}% probability of informed selling. VPIN: ${Math.round(vpin)}`;
  } else {
    reasoning = `Balanced order flow: No directional bias detected. VPIN: ${Math.round(vpin)}`;
  }

  return {
    vpin: Math.round(vpin),
    buyVolume: Math.round(totalBuyVolume),
    sellVolume: Math.round(totalSellVolume),
    volumeDelta: Math.round(volumeDelta),
    toxicity,
    informedTradingProbability: Math.round(informedTradingProbability),
    reasoning,
  };
}

// Alternative VPIN calculation using tick-by-tick data
export function calculateVPINFromTicks(
  ticks: Array<{ side: "BUY" | "SELL"; quantity: number }>
): VPINMetrics {
  if (ticks.length === 0) {
    return {
      vpin: 0,
      buyVolume: 0,
      sellVolume: 0,
      volumeDelta: 0,
      toxicity: "LOW",
      informedTradingProbability: 0,
      reasoning: "No tick data available",
    };
  }

  let buyVolume = 0;
  let sellVolume = 0;

  for (const tick of ticks) {
    if (tick.side === "BUY") {
      buyVolume += tick.quantity;
    } else {
      sellVolume += tick.quantity;
    }
  }

  const volumeDelta = buyVolume - sellVolume;
  const totalVolume = buyVolume + sellVolume;

  let vpin = 0;
  if (totalVolume > 0) {
    vpin = Math.abs(volumeDelta) / totalVolume;
    vpin = Math.min(100, vpin * 100);
  }

  let toxicity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  let informedTradingProbability = 0;

  if (vpin < 20) {
    toxicity = "LOW";
    informedTradingProbability = 10;
  } else if (vpin < 40) {
    toxicity = "MEDIUM";
    informedTradingProbability = 35;
  } else if (vpin < 60) {
    toxicity = "HIGH";
    informedTradingProbability = 65;
  } else {
    toxicity = "CRITICAL";
    informedTradingProbability = 85;
  }

  let reasoning = "";
  if (volumeDelta > 0) {
    reasoning = `Bullish bias: ${Math.round(informedTradingProbability)}% informed buying probability`;
  } else if (volumeDelta < 0) {
    reasoning = `Bearish bias: ${Math.round(informedTradingProbability)}% informed selling probability`;
  } else {
    reasoning = "Balanced order flow";
  }

  return {
    vpin: Math.round(vpin),
    buyVolume,
    sellVolume,
    volumeDelta,
    toxicity,
    informedTradingProbability: Math.round(informedTradingProbability),
    reasoning,
  };
}
