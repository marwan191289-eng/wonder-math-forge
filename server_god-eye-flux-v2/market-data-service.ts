/**
 * Market Data Service
 * Handles persistence and retrieval of live Binance market data
 */

import { eq, desc, and, gte } from 'drizzle-orm';
import { getDb } from './db';
import {
  marketData,
  klines,
  orderBook,
  type MarketData,
  type Kline,
  type OrderBook as OrderBookType,
} from '../drizzle/schema';
import { binanceClient, type BinanceKline, type BinanceOrderBook, type BinanceTicker } from './binance-client';
import { validateAndCleanKline, validateAndCleanOrderBook, validateAndCleanTicker, dataQualityMonitor } from './data-validation';

/**
 * Save market ticker data to database
 */
export async function saveMarketData(symbol: string, ticker: BinanceTicker): Promise<MarketData | null> {
  const validation = validateAndCleanTicker(ticker);
  dataQualityMonitor.recordValidation(symbol, validation.qualityScore);

  if (!validation.isValid) {
    console.warn(`[MarketData] Invalid ticker for ${symbol}:`, validation.errors);
    return null;
  }

  const db = await getDb();
  if (!db) {
    console.warn('[MarketData] Database not available');
    return null;
  }

  try {
    const timestamp = Date.now();
    const price = parseFloat(ticker.lastPrice);
    const volume24h = parseFloat(ticker.volume);
    const priceChange24h = parseFloat(ticker.priceChange);
    const highPrice24h = parseFloat(ticker.highPrice);
    const lowPrice24h = parseFloat(ticker.lowPrice);

    const result = await db
      .insert(marketData)
      .values({
        symbol,
        timestamp,
        price: price.toString(),
        volume24h: volume24h.toString(),
        priceChange24h: priceChange24h.toString(),
        highPrice24h: highPrice24h.toString(),
        lowPrice24h: lowPrice24h.toString(),
        dataQuality: validation.qualityScore,
      })
      .execute();

    console.log(`[MarketData] Saved ticker for ${symbol}`);
    return {
      id: 0,
      symbol,
      timestamp,
      price: price.toString(),
      volume24h: volume24h.toString(),
      priceChange24h: priceChange24h.toString(),
      highPrice24h: highPrice24h.toString(),
      lowPrice24h: lowPrice24h.toString(),
      dataQuality: validation.qualityScore,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error(`[MarketData] Failed to save market data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Save kline data to database
 */
export async function saveKlines(symbol: string, interval: string, klinesData: BinanceKline[]): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.warn('[MarketData] Database not available');
    return 0;
  }

  let savedCount = 0;

  for (const k of klinesData) {
    const validation = validateAndCleanKline(k);

    if (!validation.isValid) {
      console.warn(`[MarketData] Invalid kline for ${symbol}:`, validation.errors);
      continue;
    }

    try {
      await db
        .insert(klines)
        .values({
          symbol,
          interval,
          openTime: k.openTime,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          closeTime: k.closeTime,
          quoteAssetVolume: k.quoteAssetVolume,
          numberOfTrades: k.numberOfTrades,
          takerBuyBaseAssetVolume: k.takerBuyBaseAssetVolume,
          takerBuyQuoteAssetVolume: k.takerBuyQuoteAssetVolume,
        })
        .execute();

      savedCount++;
    } catch (error) {
      console.error(`[MarketData] Failed to save kline for ${symbol}:`, error);
    }
  }

  console.log(`[MarketData] Saved ${savedCount}/${klinesData.length} klines for ${symbol} (${interval})`);
  return savedCount;
}

/**
 * Save order book snapshot to database
 */
export async function saveOrderBook(symbol: string, book: BinanceOrderBook, currentPrice: number): Promise<OrderBookType | null> {
  const validation = validateAndCleanOrderBook(book);
  dataQualityMonitor.recordValidation(`${symbol}_orderbook`, validation.qualityScore);

  if (!validation.isValid) {
    console.warn(`[MarketData] Invalid order book for ${symbol}:`, validation.errors);
    return null;
  }

  const db = await getDb();
  if (!db) {
    console.warn('[MarketData] Database not available');
    return null;
  }

  try {
    const bestBid = parseFloat(book.bids[0]?.[0] || '0');
    const bestAsk = parseFloat(book.asks[0]?.[0] || '0');
    const bidVolume = parseFloat(book.bids[0]?.[1] || '0');
    const askVolume = parseFloat(book.asks[0]?.[1] || '0');

    const bidUsd = bestBid * bidVolume;
    const askUsd = bestAsk * askVolume;
    const spread = bestAsk - bestBid;
    const spreadPct = (spread / bestBid) * 100;

    const timestamp = Date.now();

    const result = await db
      .insert(orderBook)
      .values({
        symbol,
        timestamp,
        bestBid: bestBid.toString(),
        bestAsk: bestAsk.toString(),
        bidVolume: bidVolume.toString(),
        askVolume: askVolume.toString(),
        bidUsd: bidUsd.toString(),
        askUsd: askUsd.toString(),
        spread: spread.toString(),
        spreadPct: spreadPct.toString(),
      })
      .execute();

    console.log(`[MarketData] Saved order book for ${symbol}`);
    return {
      id: 0,
      symbol,
      timestamp,
      bestBid: bestBid.toString(),
      bestAsk: bestAsk.toString(),
      bidVolume: bidVolume.toString(),
      askVolume: askVolume.toString(),
      bidUsd: bidUsd.toString(),
      askUsd: askUsd.toString(),
      spread: spread.toString(),
      spreadPct: spreadPct.toString(),
      createdAt: new Date(),
    };
  } catch (error) {
    console.error(`[MarketData] Failed to save order book for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch latest market data for a symbol
 */
export async function getLatestMarketData(symbol: string): Promise<MarketData | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol))
      .orderBy(desc(marketData.timestamp))
      .limit(1)
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error(`[MarketData] Failed to fetch market data for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch klines for a symbol within time range
 */
export async function getKlinesInRange(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<Kline[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(klines)
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          gte(klines.openTime, startTime),
          gte(klines.closeTime, endTime)
        )
      )
      .orderBy(desc(klines.openTime))
      .execute();

    return result;
  } catch (error) {
    console.error(`[MarketData] Failed to fetch klines for ${symbol}:`, error);
    return [];
  }
}

/**
 * Fetch latest order book for a symbol
 */
export async function getLatestOrderBook(symbol: string): Promise<OrderBookType | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db
      .select()
      .from(orderBook)
      .where(eq(orderBook.symbol, symbol))
      .orderBy(desc(orderBook.timestamp))
      .limit(1)
      .execute();

    return result[0] || null;
  } catch (error) {
    console.error(`[MarketData] Failed to fetch order book for ${symbol}:`, error);
    return null;
  }
}

/**
 * Get data quality metrics for a symbol
 */
export function getDataQualityMetrics(symbol: string) {
  const avgQuality = dataQualityMonitor.getAverageQuality(symbol);
  const trend = dataQualityMonitor.getQualityTrend(symbol);

  return {
    averageQuality: avgQuality,
    trend,
    status: avgQuality >= 90 ? 'excellent' : avgQuality >= 80 ? 'good' : avgQuality >= 70 ? 'fair' : 'poor',
  };
}
