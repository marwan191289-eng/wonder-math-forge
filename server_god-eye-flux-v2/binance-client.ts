/**
 * Binance REST API Client
 * Fetches real-time market data: klines, order book depth, and ticker
 * All data is live from Binance — no synthetic or mocked data
 */

import axios, { AxiosInstance } from 'axios';

const BINANCE_BASE_URL = 'https://api.binance.com/api/v3';

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

export class BinanceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BINANCE_BASE_URL,
      timeout: 10000,
    });
  }

  /**
   * Fetch klines (candlestick data) from Binance
   * @param symbol Trading pair (e.g., 'BTCUSDT')
   * @param interval Timeframe (1m, 5m, 15m, 1h, 4h, 1d, etc)
   * @param limit Number of candles to fetch (default 100, max 1000)
   */
  async getKlines(
    symbol: string,
    interval: string = '1h',
    limit: number = 100
  ): Promise<BinanceKline[]> {
    try {
      const response = await this.client.get<any[]>('/klines', {
        params: {
          symbol,
          interval,
          limit: Math.min(limit, 1000),
        },
      });

      return response.data.map(k => ({
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
      console.error(`[Binance] Failed to fetch klines for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch order book depth from Binance
   * @param symbol Trading pair
   * @param limit Depth levels (5, 10, 20, 50, 100, 500, 1000, 5000)
   */
  async getOrderBook(symbol: string, limit: number = 20): Promise<BinanceOrderBook> {
    try {
      const validLimits = [5, 10, 20, 50, 100, 500, 1000, 5000];
      const safeLimit = validLimits.includes(limit) ? limit : 20;

      const response = await this.client.get<BinanceOrderBook>('/depth', {
        params: {
          symbol,
          limit: safeLimit,
        },
      });

      return response.data;
    } catch (error) {
      console.error(`[Binance] Failed to fetch order book for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch 24h ticker data from Binance
   * @param symbol Trading pair
   */
  async getTicker(symbol: string): Promise<BinanceTicker> {
    try {
      const response = await this.client.get<BinanceTicker>('/ticker/24hr', {
        params: { symbol },
      });

      return response.data;
    } catch (error) {
      console.error(`[Binance] Failed to fetch ticker for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch multiple tickers at once (more efficient)
   * @param symbols Array of trading pairs
   */
  async getMultipleTickers(symbols: string[]): Promise<BinanceTicker[]> {
    try {
      const response = await this.client.get<BinanceTicker[]>('/ticker/24hr', {
        params: {
          symbols: JSON.stringify(symbols),
        },
      });

      return response.data;
    } catch (error) {
      console.error(`[Binance] Failed to fetch multiple tickers:`, error);
      throw error;
    }
  }

  /**
   * Get current server time from Binance
   */
  async getServerTime(): Promise<number> {
    try {
      const response = await this.client.get<{ serverTime: number }>('/time');
      return response.data.serverTime;
    } catch (error) {
      console.error('[Binance] Failed to fetch server time:', error);
      throw error;
    }
  }

  /**
   * Validate that a symbol exists on Binance
   */
  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      await this.getTicker(symbol);
      return true;
    } catch (error) {
      return false;
    }
  }
}

export const binanceClient = new BinanceClient();
