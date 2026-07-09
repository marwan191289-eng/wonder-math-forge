/**
 * WebSocketManager - Multi-Exchange Failover with Heartbeat
 * 
 * Manages connections to Binance, Kraken, Bybit, Coinbase with automatic failover.
 * Implements exponential backoff, heartbeat monitoring, and reconnection logic.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface TickerUpdate {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume: number;
  bid: number;
  ask: number;
  timestamp: number;
  source: 'binance' | 'kraken' | 'bybit' | 'coinbase';
}

export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private backoff = 1000;
  private maxBackoff = 30000;
  private currentExchangeIndex = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private subscriptions = new Set<string>();

  private readonly exchanges = [
    {
      name: 'binance',
      url: 'wss://stream.binance.com:9443/ws',
      parser: this.parseBinanceMessage.bind(this),
    },
    {
      name: 'kraken',
      url: 'wss://ws.kraken.com',
      parser: this.parseKrakenMessage.bind(this),
    },
    {
      name: 'bybit',
      url: 'wss://stream.bybit.com/v5/public/spot',
      parser: this.parseBybitMessage.bind(this),
    },
    {
      name: 'coinbase',
      url: 'wss://ws-feed.exchange.coinbase.com',
      parser: this.parseCoinbaseMessage.bind(this),
    },
  ];

  constructor() {
    super();
  }

  /**
   * Connect to the current exchange, with automatic failover
   */
  public connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;
    const exchange = this.exchanges[this.currentExchangeIndex];

    console.log(`[WebSocketManager] Connecting to ${exchange.name} (${exchange.url})`);

    try {
      this.ws = new WebSocket(exchange.url);

      this.ws.on('open', () => {
        console.log(`[WebSocketManager] Connected to ${exchange.name}`);
        this.isConnecting = false;
        this.backoff = 1000; // Reset backoff on successful connection
        this.emit('connected', exchange.name);

        // Start heartbeat
        this.startHeartbeat(exchange.name);

        // Resubscribe to all symbols
        this.resubscribeAll();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          const ticker = exchange.parser(message);
          if (ticker) {
            this.emit('ticker', ticker);
          }
        } catch (err) {
          console.error(`[WebSocketManager] Parse error from ${exchange.name}:`, err);
        }
      });

      this.ws.on('error', (err: Error) => {
        console.error(`[WebSocketManager] Error from ${exchange.name}:`, err.message);
      });

      this.ws.on('close', () => {
        console.log(`[WebSocketManager] Disconnected from ${exchange.name}`);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.failover();
      });
    } catch (err) {
      console.error(`[WebSocketManager] Connection error:`, err);
      this.isConnecting = false;
      this.failover();
    }
  }

  /**
   * Subscribe to a symbol's ticker updates
   */
  public subscribe(symbol: string): void {
    this.subscriptions.add(symbol);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscription(symbol);
    }
  }

  /**
   * Unsubscribe from a symbol
   */
  public unsubscribe(symbol: string): void {
    this.subscriptions.delete(symbol);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscription(symbol);
    }
  }

  /**
   * Failover to the next exchange
   */
  private failover(): void {
    this.currentExchangeIndex = (this.currentExchangeIndex + 1) % this.exchanges.length;
    
    // Exponential backoff
    const delay = Math.min(this.backoff, this.maxBackoff);
    this.backoff *= 2;

    console.log(`[WebSocketManager] Failover to ${this.exchanges[this.currentExchangeIndex].name} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Resubscribe to all symbols after reconnection
   */
  private resubscribeAll(): void {
    for (const symbol of this.subscriptions) {
      this.sendSubscription(symbol);
    }
  }

  /**
   * Send subscription message based on current exchange
   */
  private sendSubscription(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const exchange = this.exchanges[this.currentExchangeIndex];

    try {
      if (exchange.name === 'binance') {
        this.ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: [`${symbol.toLowerCase()}@ticker`],
          id: Date.now(),
        }));
      } else if (exchange.name === 'kraken') {
        this.ws.send(JSON.stringify({
          event: 'subscribe',
          pair: [symbol],
          subscription: { name: 'ticker' },
        }));
      } else if (exchange.name === 'bybit') {
        this.ws.send(JSON.stringify({
          op: 'subscribe',
          args: [`tickers.${symbol}`],
        }));
      } else if (exchange.name === 'coinbase') {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          product_ids: [symbol],
          channels: ['ticker'],
        }));
      }
    } catch (err) {
      console.error(`[WebSocketManager] Subscription error for ${symbol}:`, err);
    }
  }

  /**
   * Send unsubscription message
   */
  private sendUnsubscription(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const exchange = this.exchanges[this.currentExchangeIndex];

    try {
      if (exchange.name === 'binance') {
        this.ws.send(JSON.stringify({
          method: 'UNSUBSCRIBE',
          params: [`${symbol.toLowerCase()}@ticker`],
          id: Date.now(),
        }));
      } else if (exchange.name === 'kraken') {
        this.ws.send(JSON.stringify({
          event: 'unsubscribe',
          pair: [symbol],
          subscription: { name: 'ticker' },
        }));
      } else if (exchange.name === 'bybit') {
        this.ws.send(JSON.stringify({
          op: 'unsubscribe',
          args: [`tickers.${symbol}`],
        }));
      } else if (exchange.name === 'coinbase') {
        this.ws.send(JSON.stringify({
          type: 'unsubscribe',
          product_ids: [symbol],
          channels: ['ticker'],
        }));
      }
    } catch (err) {
      console.error(`[WebSocketManager] Unsubscription error for ${symbol}:`, err);
    }
  }

  /**
   * Start heartbeat to monitor connection health
   */
  private startHeartbeat(exchangeName: string): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn(`[WebSocketManager] Heartbeat: connection lost from ${exchangeName}`);
        this.failover();
        return;
      }

      try {
        if (exchangeName === 'binance') {
          this.ws.send(JSON.stringify({ method: 'PING', id: Date.now() }));
        } else if (exchangeName === 'kraken') {
          this.ws.send(JSON.stringify({ event: 'ping' }));
        } else if (exchangeName === 'bybit') {
          this.ws.send(JSON.stringify({ op: 'ping' }));
        } else if (exchangeName === 'coinbase') {
          // Coinbase doesn't require explicit heartbeat
        }
      } catch (err) {
        console.error(`[WebSocketManager] Heartbeat error:`, err);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Parse Binance ticker message
   */
  private parseBinanceMessage(msg: any): TickerUpdate | null {
    if (msg.e !== '24hrTicker') return null;

    return {
      symbol: msg.s,
      price: parseFloat(msg.c),
      change24h: parseFloat(msg.p),
      changePercent24h: parseFloat(msg.P),
      volume: parseFloat(msg.v),
      bid: parseFloat(msg.b),
      ask: parseFloat(msg.a),
      timestamp: msg.E,
      source: 'binance',
    };
  }

  /**
   * Parse Kraken ticker message
   */
  private parseKrakenMessage(msg: any): TickerUpdate | null {
    if (!Array.isArray(msg) || msg.length < 2) return null;
    if (typeof msg[1] !== 'object' || !msg[1].c) return null;

    const data = msg[1];
    const symbol = msg[2];

    return {
      symbol,
      price: parseFloat(data.c[0]),
      change24h: parseFloat(data.c[0]) - parseFloat(data.o),
      changePercent24h: ((parseFloat(data.c[0]) - parseFloat(data.o)) / parseFloat(data.o)) * 100,
      volume: parseFloat(data.v[1]),
      bid: parseFloat(data.b[0]),
      ask: parseFloat(data.a[0]),
      timestamp: Date.now(),
      source: 'kraken',
    };
  }

  /**
   * Parse Bybit ticker message
   */
  private parseBybitMessage(msg: any): TickerUpdate | null {
    if (msg.topic?.startsWith('tickers.')) {
      const data = msg.data;
      const symbol = msg.topic.replace('tickers.', '');

      return {
        symbol,
        price: parseFloat(data.lastPrice),
        change24h: parseFloat(data.price24hPcnt) * parseFloat(data.lastPrice),
        changePercent24h: parseFloat(data.price24hPcnt) * 100,
        volume: parseFloat(data.turnover24h),
        bid: parseFloat(data.bid1Price),
        ask: parseFloat(data.ask1Price),
        timestamp: Date.now(),
        source: 'bybit',
      };
    }
    return null;
  }

  /**
   * Parse Coinbase ticker message
   */
  private parseCoinbaseMessage(msg: any): TickerUpdate | null {
    if (msg.type !== 'ticker') return null;

    return {
      symbol: msg.product_id,
      price: parseFloat(msg.price),
      change24h: parseFloat(msg.price) - parseFloat(msg.open_24h),
      changePercent24h: ((parseFloat(msg.price) - parseFloat(msg.open_24h)) / parseFloat(msg.open_24h)) * 100,
      volume: parseFloat(msg.volume_24h),
      bid: parseFloat(msg.best_bid),
      ask: parseFloat(msg.best_ask),
      timestamp: msg.time ? new Date(msg.time).getTime() : Date.now(),
      source: 'coinbase',
    };
  }

  /**
   * Get connection status
   */
  public getStatus() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      exchange: this.exchanges[this.currentExchangeIndex].name,
      subscriptions: Array.from(this.subscriptions),
      backoff: this.backoff,
    };
  }

  /**
   * Disconnect gracefully
   */
  public disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
