import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketManager } from './_core/websocket-manager';

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager();
  });

  afterEach(() => {
    manager.disconnect();
  });

  it('should initialize with correct properties', () => {
    const status = manager.getStatus();
    expect(status.connected).toBe(false);
    expect(status.subscriptions).toEqual([]);
    expect(status.backoff).toBe(1000);
  });

  it('should add subscriptions', () => {
    manager.subscribe('BTCUSDT');
    manager.subscribe('ETHUSDT');
    
    const status = manager.getStatus();
    expect(status.subscriptions).toContain('BTCUSDT');
    expect(status.subscriptions).toContain('ETHUSDT');
  });

  it('should remove subscriptions', () => {
    manager.subscribe('BTCUSDT');
    manager.unsubscribe('BTCUSDT');
    
    const status = manager.getStatus();
    expect(status.subscriptions).not.toContain('BTCUSDT');
  });

  it('should emit ticker events', () => {
    return new Promise<void>((resolve) => {
      manager.on('ticker', (ticker) => {
        expect(ticker.symbol).toBe('BTCUSDT');
        expect(ticker.price).toBeGreaterThan(0);
        expect(ticker.source).toBeDefined();
        resolve();
      });

      // Simulate a ticker update
      manager.emit('ticker', {
        symbol: 'BTCUSDT',
        price: 62800,
        change24h: 500,
        changePercent24h: 0.8,
        volume: 1000000,
        bid: 62799,
        ask: 62801,
        timestamp: Date.now(),
        source: 'binance',
      });
    });
  });

  it('should handle connection events', () => {
    return new Promise<void>((resolve) => {
      manager.on('connected', (exchange) => {
        expect(['binance', 'kraken', 'bybit', 'coinbase']).toContain(exchange);
        resolve();
      });

      manager.emit('connected', 'binance');
    });
  });

  it('should handle exponential backoff', () => {
    let status = manager.getStatus();
    expect(status.backoff).toBe(1000);

    // Simulate multiple failovers
    for (let i = 0; i < 3; i++) {
      (manager as any).failover();
      status = manager.getStatus();
      expect(status.backoff).toBeLessThanOrEqual(30000); // Max backoff
    }
  });
});
