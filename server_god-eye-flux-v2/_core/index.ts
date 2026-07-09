import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerMultiExchangeWSPooled } from "./multi-exchange-ws-pooled";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Multi-Exchange WebSocket SSE bridge with pooling (Binance + Kraken + Bybit fallback)
  registerMultiExchangeWSPooled(app);
  console.log('[MultiExchangeWSPooled] Real-time data streaming initialized');

  // RL Agent REST API endpoints
  let rlModule: any;
  try {
    rlModule = await import('../rl-agent.ts');
  } catch (err) {
    console.warn('[RL Agent] Module not available, skipping RL endpoints');
  }

  // GET /api/rl/stats/:symbol
  if (rlModule) {
    app.get('/api/rl/stats/:symbol', async (req, res) => {
      try {
        await rlModule.getOrCreateAgent(req.params.symbol);
        res.json(rlModule.getAgentStatus(req.params.symbol));
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });

    // POST /api/rl/action
    app.post('/api/rl/action', express.json(), async (req, res) => {
      try {
        const { symbol, state } = req.body;
        if (!symbol || !state) return res.status(400).json({ error: 'Missing symbol or state' });
        const ticker = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const { price } = await ticker.json() as { price: string };
        const result = await rlModule.stepAgent(symbol, state, parseFloat(price));
        const status = rlModule.getAgentStatus(symbol) as any;
        const actionMap: Record<string, number> = { hold: 0, buy: 1, sell: 2 };
        res.json({
          action: actionMap[result.action] ?? 0,
          actionName: result.action,
          probs: result.probs.map((p: number) => p / 100),
          confidence: result.confidence,
          stats: status,
        });
      } catch (err) {
        res.status(500).json({ error: String(err) });
      }
    });
  }

  // POST /api/rl/train
  app.post('/api/rl/train', express.json(), async (req, res) => {
    try {
      const { symbol } = req.body;
      if (!symbol) return res.status(400).json({ error: 'Missing symbol' });
      const agent = await rlModule.getOrCreateAgent(symbol);
      await rlModule.saveWeightsToDb(symbol, agent);
      res.json({ success: true, stats: rlModule.getAgentStatus(symbol) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/rl/reset/:symbol
  app.post('/api/rl/reset/:symbol', async (req, res) => {
    try {
      rlModule.deactivateAgent(req.params.symbol);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // Binance API proxy — forwards requests to Binance REST API with multi-exchange fallback
  app.get('/api/binance', async (req, res) => {
    try {
      const path = req.query.path as string;
      if (!path) return res.status(400).json({ error: 'Missing path' });
      const url = `https://api.binance.com${path}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
      const data = await response.json();
      if (path.includes('klines')) {
        if (Array.isArray(data)) {
          return res.json(data);
        }
        console.error('[Binance Proxy] klines returned non-array:', typeof data);
        return res.json([]);
      }
      res.json(data);
    } catch (err) {
      console.error('[Binance Proxy Error]', err);
      res.status(500).json({ error: 'Binance proxy error' });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
