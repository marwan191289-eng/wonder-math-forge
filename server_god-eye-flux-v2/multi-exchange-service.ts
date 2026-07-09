/**
 * Multi-Exchange Data Aggregation Service
 * 
 * Integrates data from multiple sources:
 * - Binance (primary)
 * - CoinGecko (market data, sentiment)
 * - Kraken (alternative exchange data)
 * - Bybit (derivatives, funding rates)
 * - OKX (advanced trading data)
 * 
 * Provides data normalization, validation, and cross-exchange analysis
 */

import axios from 'axios';

export interface ExchangePrice {
  symbol: string;
  exchange: 'binance' | 'kraken' | 'bybit' | 'okx' | 'coingecko';
  price: number;
  timestamp: number;
  volume24h?: number;
  change24h?: number;
}

export interface AggregatedPrice {
  symbol: string;
  prices: ExchangePrice[];
  averagePrice: number;
  medianPrice: number;
  priceDeviation: number; // % deviation from median
  bestPrice: { exchange: string; price: number };
  worstPrice: { exchange: string; price: number };
  crossExchangeArbitrage: number; // % opportunity
  confidence: number; // 0-1 based on data consistency
}

export interface FundingRate {
  symbol: string;
  exchange: 'bybit' | 'okx';
  rate: number; // percentage
  timestamp: number;
  nextFundingTime?: number;
}

export interface MarketSentiment {
  symbol: string;
  fearGreedIndex?: number; // 0-100
  socialVolume?: number;
  dominance?: number; // market cap dominance %
  timestamp: number;
}

/**
 * CoinGecko API Client
 */
class CoinGeckoClient {
  private baseUrl = 'https://api.coingecko.com/api/v3';

  async getPrice(coinId: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/simple/price`, {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
        },
        timeout: 5000,
      });
      return response.data[coinId]?.usd || null;
    } catch (error) {
      console.error(`[CoinGecko] Error fetching price for ${coinId}:`, error);
      return null;
    }
  }

  async getMarketData(coinId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/coins/${coinId}`, {
        timeout: 5000,
      });
      return {
        price: response.data.market_data.current_price.usd,
        marketCap: response.data.market_data.market_cap.usd,
        volume24h: response.data.market_data.total_volume.usd,
        change24h: response.data.market_data.price_change_percentage_24h,
        dominance: response.data.market_cap_change_percentage_24h,
      };
    } catch (error) {
      console.error(`[CoinGecko] Error fetching market data for ${coinId}:`, error);
      return null;
    }
  }

  async getFearGreedIndex(): Promise<number | null> {
    try {
      const response = await axios.get('https://api.alternative.me/fng/', {
        timeout: 5000,
      });
      return parseInt(response.data.data[0].value);
    } catch (error) {
      console.error('[CoinGecko] Error fetching Fear & Greed Index:', error);
      return null;
    }
  }
}

/**
 * Kraken API Client
 */
class KrakenClient {
  private baseUrl = 'https://api.kraken.com/0/public';

  async getPrice(pair: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/Ticker`, {
        params: { pair },
        timeout: 5000,
      });
      const key = Object.keys(response.data.result)[0];
      return parseFloat(response.data.result[key].c[0]);
    } catch (error) {
      console.error(`[Kraken] Error fetching price for ${pair}:`, error);
      return null;
    }
  }

  async getOrderBook(pair: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/Depth`, {
        params: { pair, count: 20 },
        timeout: 5000,
      });
      return response.data.result[Object.keys(response.data.result)[0]];
    } catch (error) {
      console.error(`[Kraken] Error fetching order book for ${pair}:`, error);
      return null;
    }
  }
}

/**
 * Bybit API Client
 */
class BybitClient {
  private baseUrl = 'https://api.bybit.com/v5/market';

  async getPrice(symbol: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/tickers`, {
        params: { category: 'spot', symbol },
        timeout: 5000,
      });
      return parseFloat(response.data.result.list[0].lastPrice);
    } catch (error) {
      console.error(`[Bybit] Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  async getFundingRate(symbol: string): Promise<FundingRate | null> {
    try {
      const response = await axios.get('https://api.bybit.com/v5/market/funding/history', {
        params: { category: 'linear', symbol, limit: 1 },
        timeout: 5000,
      });
      const data = response.data.result.list[0];
      return {
        symbol,
        exchange: 'bybit',
        rate: parseFloat(data.fundingRate) * 100,
        timestamp: parseInt(data.fundingRateTimestamp),
      };
    } catch (error) {
      console.error(`[Bybit] Error fetching funding rate for ${symbol}:`, error);
      return null;
    }
  }

  async getOpenInterest(symbol: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/open-interest`, {
        params: { category: 'linear', symbol, intervalTime: '5min' },
        timeout: 5000,
      });
      return parseFloat(response.data.result.openInterest);
    } catch (error) {
      console.error(`[Bybit] Error fetching open interest for ${symbol}:`, error);
      return null;
    }
  }
}

/**
 * OKX API Client
 */
class OKXClient {
  private baseUrl = 'https://www.okx.com/api/v5/market';

  async getPrice(symbol: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/ticker`, {
        params: { instId: symbol },
        timeout: 5000,
      });
      return parseFloat(response.data.data[0].last);
    } catch (error) {
      console.error(`[OKX] Error fetching price for ${symbol}:`, error);
      return null;
    }
  }

  async getFundingRate(symbol: string): Promise<FundingRate | null> {
    try {
      const response = await axios.get('https://www.okx.com/api/v5/public/funding-rate', {
        params: { instId: symbol },
        timeout: 5000,
      });
      const data = response.data.data[0];
      return {
        symbol,
        exchange: 'okx',
        rate: parseFloat(data.fundingRate) * 100,
        timestamp: parseInt(data.fundingTime),
        nextFundingTime: parseInt(data.nextFundingTime),
      };
    } catch (error) {
      console.error(`[OKX] Error fetching funding rate for ${symbol}:`, error);
      return null;
    }
  }

  async getOrderBook(symbol: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/books`, {
        params: { instId: symbol, sz: 20 },
        timeout: 5000,
      });
      return response.data.data[0];
    } catch (error) {
      console.error(`[OKX] Error fetching order book for ${symbol}:`, error);
      return null;
    }
  }
}

/**
 * Multi-Exchange Aggregator
 */
export class MultiExchangeAggregator {
  private coingecko = new CoinGeckoClient();
  private kraken = new KrakenClient();
  private bybit = new BybitClient();
  private okx = new OKXClient();

  /**
   * Get aggregated price from multiple exchanges
   */
  async getAggregatedPrice(symbol: string, coinId: string): Promise<AggregatedPrice | null> {
    const prices: ExchangePrice[] = [];
    const timestamp = Date.now();

    // Fetch from all exchanges in parallel
    const [binancePrice, krakenPrice, bybitPrice, okxPrice, coingeckoPrice] = await Promise.all([
      this.getBinancePrice(symbol),
      this.kraken.getPrice(symbol.replace('USDT', 'USD')),
      this.bybit.getPrice(symbol),
      this.okx.getPrice(symbol),
      this.coingecko.getPrice(coinId),
    ]);

    if (binancePrice) prices.push({ symbol, exchange: 'binance', price: binancePrice, timestamp });
    if (krakenPrice) prices.push({ symbol, exchange: 'kraken', price: krakenPrice, timestamp });
    if (bybitPrice) prices.push({ symbol, exchange: 'bybit', price: bybitPrice, timestamp });
    if (okxPrice) prices.push({ symbol, exchange: 'okx', price: okxPrice, timestamp });
    if (coingeckoPrice) prices.push({ symbol, exchange: 'coingecko', price: coingeckoPrice, timestamp });

    if (prices.length === 0) return null;

    // Calculate statistics
    const priceValues = prices.map((p) => p.price).sort((a, b) => a - b);
    const averagePrice = priceValues.reduce((a, b) => a + b, 0) / priceValues.length;
    const medianPrice = priceValues[Math.floor(priceValues.length / 2)];

    // Calculate deviation
    const deviations = priceValues.map((p) => Math.abs(p - medianPrice) / medianPrice);
    const priceDeviation = (Math.max(...deviations) * 100).toFixed(2);

    // Find best and worst prices
    const bestPrice = prices.reduce((a, b) => (a.price > b.price ? a : b));
    const worstPrice = prices.reduce((a, b) => (a.price < b.price ? a : b));

    // Calculate arbitrage opportunity
    const arbitrage = ((bestPrice.price - worstPrice.price) / worstPrice.price) * 100;

    // Confidence based on data consistency
    const confidence = 1 - Math.min(1, parseFloat(priceDeviation as any) / 5);

    return {
      symbol,
      prices,
      averagePrice,
      medianPrice,
      priceDeviation: parseFloat(priceDeviation as any),
      bestPrice: { exchange: bestPrice.exchange, price: bestPrice.price },
      worstPrice: { exchange: worstPrice.exchange, price: worstPrice.price },
      crossExchangeArbitrage: arbitrage,
      confidence,
    };
  }

  /**
   * Get funding rates from derivatives exchanges
   */
  async getFundingRates(symbol: string): Promise<FundingRate[]> {
    const [bybitRate, okxRate] = await Promise.all([
      this.bybit.getFundingRate(symbol),
      this.okx.getFundingRate(symbol),
    ]);

    return [bybitRate, okxRate].filter((r) => r !== null) as FundingRate[];
  }

  /**
   * Get market sentiment
   */
  async getMarketSentiment(): Promise<MarketSentiment | null> {
    const [fearGreedIndex] = await Promise.all([this.coingecko.getFearGreedIndex()]);

    if (fearGreedIndex === null) return null;

    return {
      symbol: 'BTC',
      fearGreedIndex,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect cross-exchange arbitrage opportunities
   */
  async detectArbitrage(symbol: string, coinId: string, minThreshold: number = 0.5): Promise<any> {
    const aggregated = await this.getAggregatedPrice(symbol, coinId);
    if (!aggregated || aggregated.crossExchangeArbitrage < minThreshold) {
      return null;
    }

    return {
      symbol,
      opportunity: aggregated.crossExchangeArbitrage,
      buy: aggregated.worstPrice,
      sell: aggregated.bestPrice,
      profit: aggregated.crossExchangeArbitrage,
      confidence: aggregated.confidence,
      timestamp: Date.now(),
    };
  }

  /**
   * Get Binance price (placeholder - integrate with existing binance-client)
   */
  private async getBinancePrice(symbol: string): Promise<number | null> {
    // This would integrate with existing Binance client
    return null;
  }
}

// Export singleton instance
export const multiExchangeAggregator = new MultiExchangeAggregator();
