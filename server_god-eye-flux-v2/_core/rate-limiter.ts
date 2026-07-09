import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
}

interface RequestCounter {
  count: number;
  resetTime: number;
}

const requestCounts = new Map<string, RequestCounter>();

export function createRateLimiter(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();

    let counter = requestCounts.get(key);

    // Reset counter if window expired
    if (!counter || now >= counter.resetTime) {
      counter = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      requestCounts.set(key, counter);
    }

    counter.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - counter.count));
    res.setHeader('X-RateLimit-Reset', new Date(counter.resetTime).toISOString());

    if (counter.count > config.maxRequests) {
      return res.status(429).json({
        error: config.message || 'Too many requests',
        retryAfter: Math.ceil((counter.resetTime - now) / 1000),
      });
    }

    next();
  };
}

// Exchange-specific rate limiters
export const binanceRateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 1200, // 20 req/s
  message: 'Binance API rate limit exceeded',
});

export const krakenRateLimiter = createRateLimiter({
  windowMs: 1000,
  maxRequests: 15,
  message: 'Kraken API rate limit exceeded',
});

export const bybitRateLimiter = createRateLimiter({
  windowMs: 1000,
  maxRequests: 30,
  message: 'Bybit API rate limit exceeded',
});

export const userRateLimiter = createRateLimiter({
  windowMs: 60000,
  maxRequests: 100,
  message: 'User request limit exceeded',
});
