/**
 * Binance WebSocket Bridge
 * Connects to Binance WebSocket streams server-side and forwards
 * updates to connected browser clients via Server-Sent Events (SSE).
 * SSE is used instead of raw WS to avoid port conflicts and work
 * seamlessly through the existing Express server.
 *
 * Streams: bookTicker (best bid/ask, sub-100ms) + miniTicker (price/volume)
 */

import { Express, Request, Response } from 'express';
import WebSocket from 'ws';

interface BookTickerData {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  lastPrice?: string;
  priceChange?: string;
  priceChangePercent?: string;
  volume?: string;
}

// ── SSE client registry ───────────────────────────────────────────────────────
const sseClients = new Map<string, Set<Response>>();

function addClient(symbol: string, res: Response): void {
  if (!sseClients.has(symbol)) sseClients.set(symbol, new Set());
  sseClients.get(symbol)!.add(res);
}

function removeClient(symbol: string, res: Response): void {
  sseClients.get(symbol)?.delete(res);
}

function broadcast(symbol: string, data: object): void {
  const clients = sseClients.get(symbol);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch { clients.delete(res); }
  }
}

// ── Binance WebSocket connections ─────────────────────────────────────────────
const activeStreams = new Map<string, WebSocket>();

function connectStream(symbol: string): void {
  if (activeStreams.has(symbol)) return;

  const sym = symbol.toLowerCase();
  // Combined stream: bookTicker + miniTicker
  const url = `wss://stream.binance.com:9443/stream?streams=${sym}@bookTicker/${sym}@miniTicker`;

  let ws: WebSocket;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectDelay = 1000;

  function connect() {
    ws = new WebSocket(url);
    activeStreams.set(symbol, ws);

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        const d = msg.data;
        if (!d) return;

        if (d.e === 'bookTicker') {
          broadcast(symbol, {
            type: 'bookTicker',
            symbol,
            bidPrice: d.b,
            bidQty: d.B,
            askPrice: d.a,
            askQty: d.A,
            ts: Date.now(),
          });
        } else if (d.e === '24hrMiniTicker') {
          broadcast(symbol, {
            type: 'miniTicker',
            symbol,
            lastPrice: d.c,
            priceChange: d.o ? ((parseFloat(d.c) - parseFloat(d.o)) / parseFloat(d.o) * 100).toFixed(4) : '0',
            volume: d.v,
            quoteVolume: d.q,
            high: d.h,
            low: d.l,
            ts: Date.now(),
          });
        }
      } catch { /* ignore malformed */ }
    });

    ws.on('open', () => {
      reconnectDelay = 1000;
      console.log(`[BinanceWS] Connected: ${symbol}`);
    });

    ws.on('close', () => {
      activeStreams.delete(symbol);
      reconnectTimer = setTimeout(() => {
        reconnectDelay = Math.min(30000, reconnectDelay * 2);
        connect();
      }, reconnectDelay);
    });

    ws.on('error', (err: Error) => {
      console.warn(`[BinanceWS] Error ${symbol}:`, err.message);
    });
  }

  connect();
}

function disconnectStream(symbol: string): void {
  const ws = activeStreams.get(symbol);
  if (ws) {
    ws.close();
    activeStreams.delete(symbol);
  }
}

// ── Express route registration ────────────────────────────────────────────────
export function registerBinanceWS(app: Express): void {
  // SSE endpoint: GET /api/ws/ticker/:symbol
  app.get('/api/ws/ticker/:symbol', (req: Request, res: Response) => {
    const symbol = req.params.symbol.toUpperCase();

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected', symbol, ts: Date.now() })}\n\n`);

    addClient(symbol, res);
    connectStream(symbol);

    // Heartbeat every 15s to keep connection alive
    const heartbeat = setInterval(() => {
      try { res.write(`: heartbeat\n\n`); } catch { clearInterval(heartbeat); }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(symbol, res);
      // Disconnect stream if no more clients
      if ((sseClients.get(symbol)?.size ?? 0) === 0) {
        disconnectStream(symbol);
      }
    });
  });

  // Status endpoint
  app.get('/api/ws/status', (_req: Request, res: Response) => {
    const status: Record<string, number> = {};
    for (const [sym, clients] of sseClients) {
      status[sym] = clients.size;
    }
    res.json({ activeStreams: activeStreams.size, clients: status });
  });
}
