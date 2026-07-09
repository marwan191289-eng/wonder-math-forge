/**
 * Enhanced Binance Client with Multi-Exchange Fallback
 * 
 * Implements intelligent fallback strategy:
 * 1. Try Binance (primary)
 * 2. Fallback to Kraken, Bybit, OKX
 * 3. Aggregate and normalize data
 * 
 * Handles regional restrictions (451 errors) gracefully
 */

import axios, { AxiosInstance } from 'axios';

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface BinanceOrderBook {
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][]; // [price, quantity]
  lastUpdateId: number;
}

export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

class BinanceClientBase {
  protected client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  async getKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 100
  ): Promise<BinanceKline[]> {
    try {
      const response = await this.client.get<any[]>('/klines', {
        params: { symbol, interval, limit },
      });
      return response.data.map((k: any[]) => ({
        openTime: k[0],
        open: k[1],
        high: k[2],
        low: k[3],
        close: k[4],
        volume: k[5],
        closeTime: k[6],
        quoteAssetVolume: k[7],
        numberOfTrades: k[8],
        takerBuyBaseAssetVolume: k[9],
        takerBuyQuoteAssetVolume: k[10],
      }));
    } catch (error) {
      throw error;
    }
  }

  async getOrderBook(
    symbol: string,
    limit: number = 20
  ): Promise<BinanceOrderBook> {
    try {
      const response = await this.client.get('/depth', {
        params: { symbol, limit },
      });
      return {
        bids: response.data.bids,
        asks: response.data.asks,
        lastUpdateId: response.data.lastUpdateId,
      };
    } catch (error) {
      throw error;
    }
  }

  async getTicker(symbol: string): Promise<BinanceTicker> {
    try {
      const response = await this.client.get('/ticker/24hr', {
        params: { symbol },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getMultipleTickers(symbols: string[]): Promise<BinanceTicker[]> {
    try {
      const response = await this.client.get('/ticker/24hr', {
        params: { symbols: JSON.stringify(symbols) },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Kraken API Client
 */
class KrakenClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.kraken.com/0/public',
      timeout: 10000,
    });
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit: number
  ): Promise<BinanceKline[]> {
    try {
      const pair = this.normalizePair(symbol);
      const krakenInterval = this.getKrakenInterval(interval);
      const response = await this.client.get('/OHLC', {
        params: { pair, interval: krakenInterval, since: 0 },
      });
      
      const key = Object.keys(response.data.result).find(k => k !== 'last');
      if (!key) return [];

      return response.data.result[key]
        .slice(0, limit)
        .map((k: any[]) => ({
          openTime: k[0] * 1000,
          open: String(k[1]),
          high: String(k[2]),
          low: String(k[3]),
          close: String(k[4]),
          volume: String(k[6]),
          closeTime: (k[0] + 60) * 1000,
          quoteAssetVolume: '0',
          numberOfTrades: 0,
          takerBuyBaseAssetVolume: '0',
          takerBuyQuoteAssetVolume: '0',
        }));
    } catch (error) {
      throw error;
    }
  }

  async getOrderBook(
    symbol: string,
    limit: number
  ): Promise<BinanceOrderBook> {
    try {
      const pair = this.normalizePair(symbol);
      const response = await this.client.get('/Depth', {
        params: { pair, count: limit },
      });
      
      const key = Object.keys(response.data.result)[0];
      const book = response.data.result[key];
      
      return {
        bids: book.bids.map((b: any[]) => [String(b[0]), String(b[1])]),
        asks: book.asks.map((a: any[]) => [String(a[0]), String(a[1])]),
        lastUpdateId: 0,
      };
    } catch (error) {
      throw error;
    }
  }

  async getTicker(symbol: string): Promise<BinanceTicker> {
    try {
      const pair = this.normalizePair(symbol);
      const response = await this.client.get('/Ticker', {
        params: { pair },
      });
      
      const key = Object.keys(response.data.result)[0];
      const ticker = response.data.result[key];
      
      return {
        symbol,
        priceChange: String(parseFloat(ticker.c[0]) - parseFloat(ticker.o)),
        priceChangePercent: String(((parseFloat(ticker.c[0]) - parseFloat(ticker.o)) / parseFloat(ticker.o)) * 100),
        weightedAvgPrice: ticker.c[0],
        prevClosePrice: ticker.o,
        lastPrice: ticker.c[0],
        lastQty: '0',
        bidPrice: ticker.b[0],
        bidQty: ticker.b[1],
        askPrice: ticker.a[0],
        askQty: ticker.a[1],
        openPrice: ticker.o,
        highPrice: ticker.h,
        lowPrice: ticker.l,
        volume: ticker.v[1],
        quoteVolume: ticker.v[0],
        openTime: 0,
        closeTime: Date.now(),
        firstId: 0,
        lastId: 0,
        count: 0,
      };
    } catch (error) {
      throw error;
    }
  }

  private normalizePair(symbol: string): string {
    return symbol.replace('USDT', 'USD');
  }

  private getKrakenInterval(binanceInterval: string): number {
    const map: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
      '1w': 10080,
    };
    return map[binanceInterval] || 60;
  }
}

/**
 * Bybit API Client
 */
class BybitClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.bybit.com/v5',
      timeout: 10000,
    });
  }

  async getKlines(
    symbol: string,
    interval: string,
    limit: number
  ): Promise<BinanceKline[]> {
    try {
      const bybitInterval = this.getBybitInterval(interval);
      const response = await this.client.get('/market/kline', {
        params: { category: 'spot', symbol, interval: bybitInterval, limit },
      });

      return response.data.result.list
        .reverse()
        .map((k: any[]) => ({
          openTime: parseInt(k[0]),
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          closeTime: parseInt(k[0]) + 60000,
          quoteAssetVolume: '0',
          numberOfTrades: 0,
          takerBuyBaseAssetVolume: '0',
          takerBuyQuoteAssetVolume: '0',
        }));
    } catch (error) {
      throw error;
    }
  }

  async getOrderBook(
    symbol: string,
    limit: number
  ): Promise<BinanceOrderBook> {
    try {
      const response = await this.client.get('/market/orderbook', {
        params: { category: 'spot', symbol, limit },
      });

      return {
        bids: response.data.result.b.map((b: any[]) => [b[0], b[1]]),
        asks: response.data.result.a.map((a: any[]) => [a[0], a[1]]),
        lastUpdateId: 0,
      };
    } catch (error) {
      throw error;
    }
  }

  async getTicker(symbol: string): Promise<BinanceTicker> {
    try {
      const response = await this.client.get('/market/tickers', {
        params: { category: 'spot', symbol },
      });

      const ticker = response.data.result.list[0];
      
      return {
        symbol,
        priceChange: String(parseFloat(ticker.lastPrice) - parseFloat(ticker.prevPrice24h)),
        priceChangePercent: ticker.price24hPcnt,
        weightedAvgPrice: ticker.lastPrice,
        prevClosePrice: ticker.prevPrice24h,
        lastPrice: ticker.lastPrice,
        lastQty: '0',
        bidPrice: ticker.bid1Price,
        bidQty: ticker.bid1Size,
        askPrice: ticker.ask1Price,
        askQty: ticker.ask1Size,
        openPrice: ticker.prevPrice24h,
        highPrice: ticker.highPrice24h,
        lowPrice: ticker.lowPrice24h,
        volume: ticker.volume24h,
        quoteVolume: ticker.turnover24h,
        openTime: 0,
        closeTime: Date.now(),
        firstId: 0,
        lastId: 0,
        count: 0,
      };
    } catch (error) {
      throw error;
    }
  }

  private getBybitInterval(binanceInterval: string): string {
    const map: Record<string, string> = {
      '1m': '1',
      '5m': '5',
      '15m': '15',
      '1h': '60',
      '4h': '240',
      '1d': 'D',
      '1w': 'W',
    };
    return map[binanceInterval] || '60';
  }
}

/**
 * Enhanced Binance Client with Multi-Exchange Fallback
 */
export class BinanceClientEnhanced extends BinanceClientBase {
  private kraken: KrakenClient;
  private bybit: BybitClient;

  constructor() {
    super(BINANCE_BASE_URL);
    this.kraken = new KrakenClient();
    this.bybit = new BybitClient();
  }

  async getKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 100
  ): Promise<BinanceKline[]> {
    // Try Binance first
    try {
      console.log(`[BinanceEnhanced] Fetching klines from Binance: ${symbol}`);
      return await super.getKlines(symbol, interval, limit);
    } catch (error: any) {
      if (error.response?.status === 451) {
        console.warn(`[BinanceEnhanced] Binance 451 - Falling back to Kraken`);
      } else {
        console.warn(`[BinanceEnhanced] Binance error: ${error.message}`);
      }
    }

    // Fallback to Kraken
    try {
      console.log(`[BinanceEnhanced] Fetching klines from Kraken: ${symbol}`);
      return await this.kraken.getKlines(symbol, interval, limit);
    } catch (error) {
      console.warn(`[BinanceEnhanced] Kraken error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Fallback to Bybit
    try {
      console.log(`[BinanceEnhanced] Fetching klines from Bybit: ${symbol}`);
      return await this.bybit.getKlines(symbol, interval, limit);
    } catch (error) {
      console.warn(`[BinanceEnhanced] Bybit error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    throw new Error(`Failed to fetch klines for ${symbol} from all exchanges`);
  }

  async getOrderBook(
    symbol: string,
    limit: number = 20
  ): Promise<BinanceOrderBook> {
    // Try Binance first
    try {
      console.log(`[BinanceEnhanced] Fetching order book from Binance: ${symbol}`);
      return await super.getOrderBook(symbol, limit);
    } catch (error: any) {
      if (error.response?.status === 451) {
        console.warn(`[BinanceEnhanced] Binance 451 - Falling back to Kraken`);
      } else {
        console.warn(`[BinanceEnhanced] Binance error: ${error.message}`);
      }
    }

    // Fallback to Kraken
    try {
      console.log(`[BinanceEnhanced] Fetching order book from Kraken: ${symbol}`);
      return await this.kraken.getOrderBook(symbol, limit);
    } catch (error) {
      console.warn(`[BinanceEnhanced] Kraken error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Fallback to Bybit
    try {
      console.log(`[BinanceEnhanced] Fetching order book from Bybit: ${symbol}`);
      return await this.bybit.getOrderBook(symbol, limit);
    } catch (error) {
      console.warn(`[BinanceEnhanced] Bybit error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    throw new Error(`Failed to fetch order book for ${symbol} from all exchanges`);
  }

  async getTicker(symbol: string): Promise<BinanceTicker> {
    // Try Binance first
    try {
      console.log(`[BinanceEnhanced] Fetching ticker from Binance: ${symbol}`);
      return await super.getTicker(symbol);
    } catch (error: any) {
      if (error.response?.status === 451) {
        console.warn(`[BinanceEnhanced] Binance 451 - Falling back to Kraken`);
      } else {
        console.warn(`[BinanceEnhanced] Binance error: ${error.message}`);
      }
    }

    // Fallback to Kraken
    try {
      console.log(`[BinanceEnhanced] Fetching ticker from Kraken: ${symbol}`);
      return await this.kraken.getTicker(symbol);
    } catch (error) {
      console.warn(`[BinanceEnhanced] Kraken error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Fallback to Bybit
    try {
      console.log(`[BinanceEnhanced] Fetching ticker from Bybit: ${symbol}`);
      return await this.bybit.getTicker(symbol);
    } catch (error) {
      console.warn(`[BinanceEnhanced] Bybit error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    throw new Error(`Failed to fetch ticker for ${symbol} from all exchanges`);
  }

  async getMultipleTickers(symbols: string[]): Promise<BinanceTicker[]> {
    // Try Binance first
    try {
      console.log(`[BinanceEnhanced] Fetching multiple tickers from Binance`);
      return await super.getMultipleTickers(symbols);
    } catch (error: any) {
      if (error.response?.status === 451) {
        console.warn(`[BinanceEnhanced] Binance 451 - Falling back to individual fetches`);
      } else {
        console.warn(`[BinanceEnhanced] Binance error: ${error.message}`);
      }
    }

    // Fallback: fetch individually
    try {
      console.log(`[BinanceEnhanced] Fetching tickers individually from Kraken`);
      return await Promise.all(symbols.map(s => this.kraken.getTicker(s)));
    } catch (error) {
      console.warn(`[BinanceEnhanced] Individual fetch error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    throw new Error(`Failed to fetch tickers from all exchanges`);
  }
}

// Export singleton instance
export const binanceClient = new BinanceClientEnhanced();
