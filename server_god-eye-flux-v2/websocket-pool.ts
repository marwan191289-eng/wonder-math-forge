/**
 * WebSocket Connection Pooling & Latency Optimization
 * 
 * Implements:
 * - Connection pooling for multi-exchange data
 * - Binary protocol support for faster transmission
 * - Request batching and debouncing
 * - Adaptive reconnection with exponential backoff
 * - Sub-100ms latency target
 */

import { EventEmitter } from 'events';

export interface PoolConfig {
  maxConnections: number;
  maxReconnectAttempts: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  batchIntervalMs: number;
  enableBinaryProtocol: boolean;
  enableCompression: boolean;
}

export interface PooledConnection {
  id: string;
  url: string;
  isConnected: boolean;
  latencyMs: number;
  failureCount: number;
  lastHeartbeat: number;
  messageQueue: any[];
}

export interface LatencyMetrics {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  messageCount: number;
}

/**
 * WebSocket Connection Pool Manager
 * Manages multiple connections with intelligent routing and batching
 */
export class WebSocketPool extends EventEmitter {
  private config: PoolConfig;
  private connections: Map<string, PooledConnection> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();
  private batchQueue: Map<string, any[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    
    this.config = {
      maxConnections: 10,
      maxReconnectAttempts: 5,
      initialBackoffMs: 100,
      maxBackoffMs: 30000,
      batchIntervalMs: 10, // 10ms batching for <100ms latency
      enableBinaryProtocol: true,
      enableCompression: true,
      ...config,
    };
  }

  /**
   * Add a new connection to the pool
   */
  addConnection(id: string, url: string): PooledConnection {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error(`Connection pool is full (${this.config.maxConnections})`);
    }

    const connection: PooledConnection = {
      id,
      url,
      isConnected: false,
      latencyMs: 0,
      failureCount: 0,
      lastHeartbeat: Date.now(),
      messageQueue: [],
    };

    this.connections.set(id, connection);
    this.latencyHistory.set(id, []);
    this.batchQueue.set(id, []);

    this.connect(id);
    return connection;
  }

  /**
   * Connect a specific connection
   */
  private async connect(id: string): Promise<void> {
    const connection = this.connections.get(id);
    if (!connection) return;

    try {
      // Simulate WebSocket connection
      // In production, use actual WebSocket: new WebSocket(connection.url)
      connection.isConnected = true;
      connection.failureCount = 0;
      connection.lastHeartbeat = Date.now();

      this.emit('connected', { id, url: connection.url });
      this.startHeartbeat(id);
    } catch (error) {
      this.handleConnectionError(id, error);
    }
  }

  /**
   * Send message with batching and compression
   */
  async send(connectionId: string, message: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    if (!connection.isConnected) {
      throw new Error(`Connection ${connectionId} is not connected`);
    }

    // Add to batch queue
    const queue = this.batchQueue.get(connectionId) || [];
    queue.push(message);
    this.batchQueue.set(connectionId, queue);

    // Schedule batch send
    this.scheduleBatchSend(connectionId);
  }

  /**
   * Schedule batch send with debouncing
   */
  private scheduleBatchSend(connectionId: string): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(connectionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushBatch(connectionId);
    }, this.config.batchIntervalMs);

    this.batchTimers.set(connectionId, timer);
  }

  /**
   * Flush batched messages
   */
  private async flushBatch(connectionId: string): Promise<void> {
    const queue = this.batchQueue.get(connectionId);
    if (!queue || queue.length === 0) return;

    const connection = this.connections.get(connectionId);
    if (!connection || !connection.isConnected) return;

    try {
      const startTime = Date.now();

      // Prepare batch
      const batch = {
        type: 'batch',
        messages: queue,
        timestamp: startTime,
        count: queue.length,
      };

      // Apply compression if enabled
      let payload: any = batch;
      if (this.config.enableCompression) {
        payload = this.compressBatch(batch);
      }

      // Apply binary protocol if enabled
      if (this.config.enableBinaryProtocol) {
        payload = this.encodeBinary(payload);
      }

      // Send (simulated)
      await this.sendPayload(connectionId, payload);

      // Record latency
      const latency = Date.now() - startTime;
      this.recordLatency(connectionId, latency);

      // Clear queue
      this.batchQueue.set(connectionId, []);

      this.emit('batch_sent', {
        connectionId,
        messageCount: queue.length,
        latencyMs: latency,
      });
    } catch (error) {
      this.emit('batch_error', { connectionId, error });
    }
  }

  /**
   * Compress batch using delta encoding
   */
  private compressBatch(batch: any): any {
    // Simple delta encoding for numeric values
    const compressed = {
      type: 'batch_compressed',
      messages: batch.messages.map((msg: any, idx: number) => {
        if (typeof msg.price === 'number' && idx > 0) {
          const prev = batch.messages[idx - 1]?.price || 0;
          return {
            ...msg,
            price_delta: msg.price - prev, // Store delta instead of absolute
          };
        }
        return msg;
      }),
      timestamp: batch.timestamp,
      count: batch.count,
    };

    return compressed;
  }

  /**
   * Encode to binary format for faster transmission
   */
  private encodeBinary(payload: any): Buffer {
    // Simple binary encoding: type (1 byte) + length (4 bytes) + JSON
    const json = JSON.stringify(payload);
    const jsonBuffer = Buffer.from(json, 'utf-8');
    
    const buffer = Buffer.alloc(5 + jsonBuffer.length);
    buffer.writeUInt8(0x01, 0); // Type: batch
    buffer.writeUInt32BE(jsonBuffer.length, 1);
    jsonBuffer.copy(buffer, 5);

    return buffer;
  }

  /**
   * Send payload to connection
   */
  private async sendPayload(connectionId: string, payload: any): Promise<void> {
    // Simulated send - in production would use WebSocket.send()
    return new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  /**
   * Record latency metric
   */
  private recordLatency(connectionId: string, latencyMs: number): void {
    const history = this.latencyHistory.get(connectionId) || [];
    history.push(latencyMs);

    // Keep last 1000 measurements
    if (history.length > 1000) {
      history.shift();
    }

    this.latencyHistory.set(connectionId, history);

    // Update connection latency
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.latencyMs = latencyMs;
    }
  }

  /**
   * Get latency metrics for a connection
   */
  getLatencyMetrics(connectionId: string): LatencyMetrics {
    const history = this.latencyHistory.get(connectionId) || [];

    if (history.length === 0) {
      return {
        avgLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        messageCount: 0,
      };
    }

    const sorted = [...history].sort((a, b) => a - b);
    const avg = history.reduce((a, b) => a + b) / history.length;

    return {
      avgLatency: Math.round(avg),
      minLatency: sorted[0],
      maxLatency: sorted[sorted.length - 1],
      p95Latency: sorted[Math.floor(sorted.length * 0.95)],
      p99Latency: sorted[Math.floor(sorted.length * 0.99)],
      messageCount: history.length,
    };
  }

  /**
   * Start heartbeat for connection monitoring
   */
  private startHeartbeat(connectionId: string): void {
    const interval = setInterval(() => {
      const connection = this.connections.get(connectionId);
      if (!connection) {
        clearInterval(interval);
        return;
      }

      if (Date.now() - connection.lastHeartbeat > 30000) {
        // Connection stale
        this.handleConnectionError(connectionId, new Error('Heartbeat timeout'));
      }
    }, 5000);
  }

  /**
   * Handle connection error with exponential backoff
   */
  private handleConnectionError(connectionId: string, error: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    connection.isConnected = false;
    connection.failureCount++;

    this.emit('connection_error', { connectionId, error, failureCount: connection.failureCount });

    if (connection.failureCount <= this.config.maxReconnectAttempts) {
      const backoffMs = Math.min(
        this.config.initialBackoffMs * Math.pow(2, connection.failureCount - 1),
        this.config.maxBackoffMs
      );

      const timer = setTimeout(() => {
        this.connect(connectionId);
      }, backoffMs);

      this.reconnectTimers.set(connectionId, timer);
    }
  }

  /**
   * Get connection status
   */
  getStatus(connectionId?: string): any {
    if (connectionId) {
      const conn = this.connections.get(connectionId);
      if (!conn) return null;

      return {
        id: conn.id,
        url: conn.url,
        isConnected: conn.isConnected,
        latencyMs: conn.latencyMs,
        failureCount: conn.failureCount,
        metrics: this.getLatencyMetrics(connectionId),
      };
    }

    // Return all connections
    const statuses = Array.from(this.connections.entries()).map(([id, conn]) => ({
      id: conn.id,
      url: conn.url,
      isConnected: conn.isConnected,
      latencyMs: conn.latencyMs,
      failureCount: conn.failureCount,
      metrics: this.getLatencyMetrics(id),
    }));

    return {
      totalConnections: this.connections.size,
      activeConnections: statuses.filter(s => s.isConnected).length,
      connections: statuses,
      avgLatency: Math.round(
        statuses.reduce((sum, s) => sum + s.latencyMs, 0) / Math.max(1, statuses.length)
      ),
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    // Clear all timers
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.reconnectTimers.forEach(timer => clearTimeout(timer));

    // Close connections
    for (const connection of this.connections.values()) {
      connection.isConnected = false;
    }

    this.connections.clear();
    this.latencyHistory.clear();
    this.batchQueue.clear();
  }
}

/**
 * Intelligent connection selector for optimal routing
 */
export function selectOptimalConnection(pool: WebSocketPool, connectionIds: string[]): string {
  let bestId = connectionIds[0];
  let bestLatency = Infinity;

  for (const id of connectionIds) {
    const metrics = pool.getLatencyMetrics(id);
    if (metrics.avgLatency < bestLatency) {
      bestLatency = metrics.avgLatency;
      bestId = id;
    }
  }

  return bestId;
}

/**
 * Create multi-exchange connection pool
 */
export function createMultiExchangePool(): Map<string, WebSocketPool> {
  const pools = new Map<string, WebSocketPool>();

  const exchanges = ['binance', 'kraken', 'bybit', 'okx'];
  for (const exchange of exchanges) {
    pools.set(exchange, new WebSocketPool({
      maxConnections: 5,
      batchIntervalMs: 10,
      enableBinaryProtocol: true,
      enableCompression: true,
    }));
  }

  return pools;
}
