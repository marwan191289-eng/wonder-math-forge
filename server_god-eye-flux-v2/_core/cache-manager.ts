interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
}

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: CacheStats = { hits: 0, misses: 0, size: 0 };
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Auto-cleanup expired entries every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data, expiresAt });
    this.stats.size = this.cache.size;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.stats.size = this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, size: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    let deleted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        deleted++;
      }
    }

    if (deleted > 0) {
      this.stats.size = this.cache.size;
    }
  }

  getStats(): CacheStats & { hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    return { ...this.stats, hitRate };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clear();
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cache key generators
export const cacheKeys = {
  ticker: (symbol: string) => `ticker:${symbol}`,
  orderBook: (symbol: string) => `orderbook:${symbol}`,
  score: (symbol: string) => `score:${symbol}`,
  marketStructure: (symbol: string) => `structure:${symbol}`,
  cvdSignal: (symbol: string) => `cvd:${symbol}`,
  orderFlow: (symbol: string) => `orderflow:${symbol}`,
  mlForecast: (symbol: string) => `ml:${symbol}`,
  rlDecision: (symbol: string) => `rl:${symbol}`,
};

// Convenience functions
export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cacheManager.get<T>(key);
  if (cached) return cached;

  const data = await fetcher();
  cacheManager.set(key, data, ttlMs);
  return data;
}
