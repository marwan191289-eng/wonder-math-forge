/**
 * Robust Data Connection Service
 * 
 * Handles all external data connections with:
 * - Automatic retry with exponential backoff
 * - Multi-exchange fallback
 * - Local caching with TTL
 * - Health monitoring
 * - Circuit breaker pattern
 */

import axios, { AxiosInstance } from 'axios';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const CACHE = new Map<string, CacheEntry<any>>();
const CIRCUIT_BREAKERS = new Map<string, CircuitBreakerState>();

const EXCHANGES = [
  { name: 'binance', baseUrl: 'https://api.binance.com/api/v3', timeout: 8000 },
  { name: 'kraken', baseUrl: 'https://api.kraken.com/0/public', timeout: 8000 },
  { name: 'bybit', baseUrl: 'https://api.bybit.com/v5/market', timeout: 8000 },
  { name: 'coinbase', baseUrl: 'https://api.exchange.coinbase.com', timeout: 8000 },
  { name: 'coingecko', baseUrl: 'https://api.coingecko.com/api/v3', timeout: 10000 },
];

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 500
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`[DataConnection] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Circuit breaker pattern
 */
function checkCircuitBreaker(key: string): boolean {
  const breaker = CIRCUIT_BREAKERS.get(key) || {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  };

  // Reset after 30 seconds
  if (breaker.state === 'OPEN' && Date.now() - breaker.lastFailureTime > 30000) {
    breaker.state = 'HALF_OPEN';
    breaker.failures = 0;
  }

  if (breaker.state === 'OPEN') {
    return false;
  }

  return true;
}

function recordCircuitBreakerFailure(key: string): void {
  const breaker = CIRCUIT_BREAKERS.get(key) || {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  };

  breaker.failures++;
  breaker.lastFailureTime = Date.now();

  // Open circuit after 5 failures
  if (breaker.failures >= 5) {
    breaker.state = 'OPEN';
    console.warn(`[CircuitBreaker] Opening circuit for ${key}`);
  }

  CIRCUIT_BREAKERS.set(key, breaker);
}

function recordCircuitBreakerSuccess(key: string): void {
  const breaker = CIRCUIT_BREAKERS.get(key);
  if (breaker) {
    breaker.failures = 0;
    breaker.state = 'CLOSED';
    CIRCUIT_BREAKERS.set(key, breaker);
  }
}

/**
 * Cache management
 */
function getCached<T>(key: string): T | null {
  const entry = CACHE.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > entry.ttl) {
    CACHE.delete(key);
    return null;
  }

  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttl: number = 30000): void {
  CACHE.set(key, { data, timestamp: Date.now(), ttl });
}

/**
 * Fetch with fallback across multiple exchanges
 */
export async function fetchWithFallback<T>(
  endpoint: string,
  params: Record<string, any> = {},
  options: {
    cacheKey?: string;
    cacheTtl?: number;
    preferredExchange?: string;
  } = {}
): Promise<T> {
  const cacheKey = options.cacheKey || `${endpoint}:${JSON.stringify(params)}`;
  const cached = getCached<T>(cacheKey);
  if (cached) {
    console.log(`[DataConnection] Cache hit for ${cacheKey}`);
    return cached;
  }

  const exchangeOrder = options.preferredExchange
    ? [
        EXCHANGES.find(e => e.name === options.preferredExchange),
        ...EXCHANGES.filter(e => e.name !== options.preferredExchange),
      ].filter(Boolean)
    : EXCHANGES;

  let lastError: Error | null = null;

  for (const exchange of exchangeOrder) {
    if (!exchange) continue;

    const circuitKey = `${exchange.name}:${endpoint}`;
    if (!checkCircuitBreaker(circuitKey)) {
      console.log(`[DataConnection] Circuit breaker open for ${exchange.name}`);
      continue;
    }

    try {
      const client = axios.create({
        baseURL: exchange.baseUrl,
        timeout: exchange.timeout,
        headers: {
          'User-Agent': 'FLUX-Trading-Intelligence/1.0',
        },
      });

      const response = await retryWithBackoff(
        () => client.get(endpoint, { params }),
        2,
        300
      );

      recordCircuitBreakerSuccess(circuitKey);
      const data = response.data;
      setCached(cacheKey, data, options.cacheTtl);
      console.log(`[DataConnection] Success from ${exchange.name} for ${endpoint}`);
      return data;
    } catch (error) {
      lastError = error as Error;
      recordCircuitBreakerFailure(circuitKey);
      console.warn(`[DataConnection] Failed from ${exchange.name}: ${lastError.message}`);
      continue;
    }
  }

  throw new Error(
    `All exchanges failed for ${endpoint}. Last error: ${lastError?.message}`
  );
}

/**
 * Fetch klines (candlestick data)
 */
export async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<any[]> {
  try {
    const data = await fetchWithFallback<any[]>(
      '/klines',
      { symbol, interval, limit },
      {
        cacheKey: `klines:${symbol}:${interval}:${limit}`,
        cacheTtl: 60000, // 1 minute
        preferredExchange: 'binance',
      }
    );
    return data || [];
  } catch (error) {
    console.error('[DataConnection] fetchKlines failed:', error);
    throw error;
  }
}

/**
 * Fetch order book
 */
export async function fetchOrderBook(
  symbol: string,
  limit: number = 20
): Promise<any> {
  try {
    const data = await fetchWithFallback(
      '/depth',
      { symbol, limit },
      {
        cacheKey: `orderbook:${symbol}:${limit}`,
        cacheTtl: 5000, // 5 seconds
        preferredExchange: 'binance',
      }
    );
    return data;
  } catch (error) {
    console.error('[DataConnection] fetchOrderBook failed:', error);
    throw error;
  }
}

/**
 * Fetch ticker data
 */
export async function fetchTicker(symbol: string): Promise<any> {
  try {
    const data = await fetchWithFallback(
      '/ticker/24hr',
      { symbol },
      {
        cacheKey: `ticker:${symbol}`,
        cacheTtl: 10000, // 10 seconds
        preferredExchange: 'binance',
      }
    );
    return data;
  } catch (error) {
    console.error('[DataConnection] fetchTicker failed:', error);
    throw error;
  }
}

/**
 * Fetch trades
 */
export async function fetchTrades(
  symbol: string,
  limit: number = 100
): Promise<any[]> {
  try {
    const data = await fetchWithFallback<any[]>(
      '/trades',
      { symbol, limit },
      {
        cacheKey: `trades:${symbol}:${limit}`,
        cacheTtl: 5000, // 5 seconds
        preferredExchange: 'binance',
      }
    );
    return data || [];
  } catch (error) {
    console.error('[DataConnection] fetchTrades failed:', error);
    throw error;
  }
}

/**
 * Health check for all exchanges
 */
export async function healthCheck(): Promise<Record<string, boolean>> {
  const health: Record<string, boolean> = {};

  for (const exchange of EXCHANGES) {
    try {
      const client = axios.create({
        baseURL: exchange.baseUrl,
        timeout: 5000,
      });

      await client.get('/ping');
      health[exchange.name] = true;
      console.log(`[HealthCheck] ${exchange.name} is healthy`);
    } catch (error) {
      health[exchange.name] = false;
      console.warn(`[HealthCheck] ${exchange.name} is down`);
    }
  }

  return health;
}

/**
 * Clear cache
 */
export function clearCache(pattern?: string): void {
  if (!pattern) {
    CACHE.clear();
    console.log('[DataConnection] Cache cleared');
    return;
  }

  for (const key of CACHE.keys()) {
    if (key.includes(pattern)) {
      CACHE.delete(key);
    }
  }
  console.log(`[DataConnection] Cache cleared for pattern: ${pattern}`);
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  size: number;
  entries: string[];
} {
  return {
    size: CACHE.size,
    entries: Array.from(CACHE.keys()),
  };
}
