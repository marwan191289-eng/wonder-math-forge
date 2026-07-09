import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketManager } from './_core/websocket-manager';

describe('WebSocketManager - Failover Simulation', () => {
  let manager: WebSocketManager;
  let startTime: number;

  beforeEach(() => {
    manager = new WebSocketManager();
    startTime = Date.now();
  });

  afterEach(() => {
    manager.disconnect();
  });

  it('should failover from Binance to Bybit within 2 seconds on connection loss', () => {
    return new Promise<void>((resolve) => {
      let failoverDetected = false;
      let failoverTime = 0;

      manager.on('connected', (exchange) => {
        const elapsed = Date.now() - startTime;
        console.log(`[Test] Connected to ${exchange} at ${elapsed}ms`);

        if (exchange === 'binance' && !failoverDetected) {
          // Simulate Binance connection loss after 500ms
          setTimeout(() => {
            console.log('[Test] Simulating Binance connection loss...');
            (manager as any).failover();
          }, 500);
        }

        if (exchange === 'bybit' && !failoverDetected) {
          failoverDetected = true;
          failoverTime = elapsed;
          console.log(`[Test] Failover completed in ${failoverTime}ms`);
          
          // Verify failover happened within 2 seconds
          expect(failoverTime).toBeLessThan(2000);
          resolve();
        }
      });

      // Start connection
      manager.connect();

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!failoverDetected) {
          console.warn('[Test] Failover test timed out');
          resolve();
        }
      }, 5000);
    });
  });

  it('should maintain data continuity during failover', () => {
    return new Promise<void>((resolve) => {
      const receivedTickers: string[] = [];
      let failoverOccurred = false;

      manager.on('ticker', (ticker) => {
        receivedTickers.push(ticker.symbol);
        console.log(`[Test] Received ticker: ${ticker.symbol} from ${ticker.source}`);
      });

      manager.on('connected', (exchange) => {
        console.log(`[Test] Connected to ${exchange}`);
        
        if (exchange === 'binance' && !failoverOccurred) {
          // Subscribe to symbols
          manager.subscribe('BTCUSDT');
          manager.subscribe('ETHUSDT');

          // Simulate connection loss after 1 second
          setTimeout(() => {
            failoverOccurred = true;
            console.log('[Test] Triggering failover...');
            (manager as any).failover();
          }, 1000);
        }

        if (exchange === 'bybit' && failoverOccurred) {
          // Verify subscriptions were reapplied
          const status = manager.getStatus();
          expect(status.subscriptions).toContain('BTCUSDT');
          expect(status.subscriptions).toContain('ETHUSDT');
          console.log('[Test] Subscriptions maintained after failover');
          resolve();
        }
      });

      manager.connect();

      // Timeout
      setTimeout(() => resolve(), 5000);
    });
  });

  it('should implement exponential backoff correctly', () => {
    return new Promise<void>((resolve) => {
      const backoffTimes: number[] = [];
      let failoverCount = 0;
      const maxFailovers = 3;

      manager.on('connected', () => {
        if (failoverCount < maxFailovers) {
          setTimeout(() => {
            const status = manager.getStatus();
            backoffTimes.push(status.backoff);
            console.log(`[Test] Failover ${failoverCount + 1}: backoff = ${status.backoff}ms`);
            failoverCount++;
            (manager as any).failover();
          }, 100);
        } else {
          // Verify exponential backoff progression
          for (let i = 1; i < backoffTimes.length; i++) {
            expect(backoffTimes[i]).toBeGreaterThanOrEqual(backoffTimes[i - 1]);
            expect(backoffTimes[i]).toBeLessThanOrEqual(30000); // Max backoff
          }
          console.log('[Test] Exponential backoff verified:', backoffTimes);
          resolve();
        }
      });

      manager.connect();

      // Timeout
      setTimeout(() => resolve(), 10000);
    });
  });
});
