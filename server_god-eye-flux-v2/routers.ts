import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { binanceClient } from "./binance-client-enhanced";
import { saveMarketData, saveOrderBook, saveKlines, getDataQualityMetrics } from "./market-data-service";
import { calculateCompositeScore } from "./scoring-engine";
import { detectWalls } from "./whale-detection";
import { analyzeSMC } from "./smc-detection";
import {
  stepAgent,
  getOrCreateAgent,
  activateAgent,
  deactivateAgent,
  getAgentStatus,
  saveWeightsToDb,
} from "./rl-agent";
import { analyzeMarketStructure } from "./market-structure";
import { detectLiquiditySweep } from "./liquidity-sweep";
import { calculateVPIN } from "./vpin-engine";
import {
  createAlert,
  listAlerts,
  deleteAlert,
  getAlertHistory,
  evaluateAlerts,
} from "./alert-engine";
import {
  createTriggeredAlert,
  getUserAlerts,
  getSymbolAlerts,
  markAlertAsRead,
  acknowledgeAlert,
  recordAlertOutcome,
  getAlertStats,
  getRecentAlerts,
} from "./triggered-alert-service";
import { analyzeUnifiedSignal } from "./unified-intelligence-engine";
import {
  calculateRSI,
  calculateMACD,
  calculateBollingerBands,
  calculateVolatility,
  calculateOrderFlow,
  calculateVolumeProfile,
} from "./technical-indicators";
import { analyzeOrderFlow } from "./order-flow-analysis";
import { fetchKlines, fetchOrderBook, fetchTicker, fetchTrades, healthCheck, clearCache } from "./data-connection-service";
import { predictPrice } from "./ml-prediction-engine-real";
import { analyticsRouter } from "./routers/analytics";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  market: router({
    getTicker: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        try {
          const ticker = await binanceClient.getTicker(input.symbol);
          const saved = await saveMarketData(input.symbol, ticker);
          return { success: true, data: saved, quality: getDataQualityMetrics(input.symbol) };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed' };
        }
      }),

    getOrderBook: publicProcedure
      .input(z.object({ symbol: z.string(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        try {
          const book = await binanceClient.getOrderBook(input.symbol, input.limit);
          const ticker = await binanceClient.getTicker(input.symbol);
          const saved = await saveOrderBook(input.symbol, book, parseFloat(ticker.lastPrice));
          return { success: true, data: saved, quality: getDataQualityMetrics(input.symbol) };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed' };
        }
      }),

    getKlines: publicProcedure
      .input(z.object({ symbol: z.string(), interval: z.string().default('1h'), limit: z.number().default(100) }))
      .query(async ({ input }) => {
        try {
          const klinesData = await binanceClient.getKlines(input.symbol, input.interval, input.limit);
          const saved = await saveKlines(input.symbol, input.interval, klinesData);
          return { success: true, savedCount: saved, quality: getDataQualityMetrics(input.symbol) };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed' };
        }
      }),
  }),

  analytics: analyticsRouter,

  // ── RL Agent endpoints ────────────────────────────────────────────────────
  rl: router({
    status: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .query(async ({ input }) => {
        await getOrCreateAgent(input.symbol);
        return getAgentStatus(input.symbol);
      }),

    activate: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .mutation(async ({ input }) => {
        await getOrCreateAgent(input.symbol);
        activateAgent(input.symbol);
        return { success: true, message: 'RL Agent activated' };
      }),

    deactivate: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .mutation(async ({ input }) => {
        deactivateAgent(input.symbol);
        return { success: true, message: 'RL Agent deactivated' };
      }),

    step: publicProcedure
      .input(z.object({
        symbol: z.string(),
        features: z.array(z.number()).length(9),
        currentPrice: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await stepAgent(input.symbol, input.features, input.currentPrice);
          return { success: true, ...result };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Step failed' };
        }
      }),

    saveWeights: publicProcedure
      .input(z.object({ symbol: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const agent = await getOrCreateAgent(input.symbol);
          await saveWeightsToDb(input.symbol, agent);
          return { success: true, message: 'Weights saved to database' };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Save failed' };
        }
      }),
  }),

  // ── Alert System endpoints ────────────────────────────────────────────────
  alerts: router({
    list: publicProcedure
      .input(z.object({ symbol: z.string().optional() }))
      .query(async ({ input }) => {
        const alerts = await listAlerts(input.symbol);
        return { success: true, data: alerts };
      }),

    create: publicProcedure
      .input(z.object({
        symbol: z.string(),
        alertType: z.enum([
          'score_above', 'score_below',
          'wall_size_above', 'imbalance_above', 'imbalance_below',
          'stop_hunt_probability', 'price_above', 'price_below',
          'cvd_divergence', 'regime_change',
        ]),
        threshold: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          const id = await createAlert(input);
          return { success: true, id, message: 'Alert created' };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Create failed' };
        }
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteAlert(input.id);
        return { success: true };
      }),

    history: publicProcedure
      .input(z.object({ symbol: z.string().optional(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const history = await getAlertHistory(input.symbol, input.limit);
        return { success: true, data: history };
      }),
  }),

  // ── Triggered Market Analysis Alerts ──────────────────────────────────────
  triggeredAlerts: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return getUserAlerts(ctx.user.id, input.limit, input.offset);
      }),

    bySymbol: publicProcedure
      .input(z.object({ symbol: z.string(), limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return getSymbolAlerts(ctx.user.id, input.symbol, input.limit);
      }),

    recent: publicProcedure
      .input(z.object({ hoursBack: z.number().default(24) }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return getRecentAlerts(ctx.user.id, input.hoursBack);
      }),

    stats: publicProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return getAlertStats(ctx.user.id);
      }),

    markAsRead: publicProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return markAlertAsRead(input.alertId, ctx.user.id);
      }),

    acknowledge: publicProcedure
      .input(z.object({ alertId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return acknowledgeAlert(input.alertId, ctx.user.id);
      }),

    recordOutcome: publicProcedure
      .input(z.object({
        alertId: z.number(),
        outcome: z.enum(["profitable", "breakeven", "loss"]),
        outcomePrice: z.number().optional(),
        profitLoss: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) return { success: false, error: "Unauthorized" };
        return recordAlertOutcome(
          input.alertId,
          ctx.user.id,
          input.outcome,
          input.outcomePrice,
          input.profitLoss
        );
      }),
  }),

  // ── Advanced ML & RL Engines ────────────────────────────────────────────────
  trading: router({
    rlDecision: publicProcedure
      .input(z.object({
        symbol: z.string(),
        timeframe: z.string().default('1h'),
      }))
      .query(async ({ input }) => {
        try {
          const klines = await binanceClient.getKlines(input.symbol, input.timeframe, 100);
          const orderBook = await binanceClient.getOrderBook(input.symbol);
          const ticker = await binanceClient.getTicker(input.symbol);
          
          // Suppress unused variable warning
          void ticker;
          
          if (!klines || klines.length === 0) {
            return { success: false, error: 'No kline data available' };
          }

          // Build agent state from market data
          const prices = klines.map(k => parseFloat(k.close));
          const volumes = klines.map(k => parseFloat(k.volume));
          const currentPrice = prices[prices.length - 1];
          
          // Calculate technical indicators
          const rsi = calculateRSI(prices);
          const macd = calculateMACD(prices);
          const bbands = calculateBollingerBands(prices);
          const volatility = calculateVolatility(prices);
          const returns = prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);
          
          // Get market structure and liquidity data
          const structure = analyzeMarketStructure(klines as any);
          const sweep = detectLiquiditySweep(klines as any);
          const vpin = calculateVPIN([orderBook] as any);
          
          // Prepare agent state
          const toxicityMap = { 'LOW': 0.25, 'MEDIUM': 0.5, 'HIGH': 0.75, 'CRITICAL': 1.0 };
          const vpinValue = vpin?.toxicity ? toxicityMap[vpin.toxicity as keyof typeof toxicityMap] || 0 : 0;
          const agentState = {
            price: currentPrice,
            returns,
            volatility,
            rsi,
            macd,
            bbands,
            orderFlow: calculateOrderFlow(orderBook),
            volumeProfile: calculateVolumeProfile(volumes),
            marketStructure: structure?.trendDirection || 'UP',
            liquiditySweep: sweep?.probability || 0,
            vpin: vpinValue,
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
          };

          // Get RL decision from advanced agent
          const { HybridRLAgent } = await import('./rl-agent-advanced');
          const agent = new HybridRLAgent();
          const decision = agent.selectAction(agentState);
          
          return {
            success: true,
            data: {
              symbol: input.symbol,
              timeframe: input.timeframe,
              action: decision.action,
              confidence: decision.confidence,
              value: decision.value,
              entropy: decision.entropy,
              timestamp: Date.now(),
            },
          };
        } catch (error) {
          console.error('[RL Decision Error]', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'RL decision failed',
          };
        }
      }),
  }),

  // Unified Intelligence Analysis
  analysis: router({
    mlForecast: publicProcedure
      .input(z.object({
        symbol: z.string(),
        timeframe: z.string().default('1h'),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        try {
          const klines = await binanceClient.getKlines(input.symbol, input.timeframe, input.limit);
          
          if (!klines || klines.length === 0) {
            return { success: false, error: 'No kline data available' };
          }

          // Extract features for ML model
          const prices = klines.map(k => parseFloat(k.close));
          const volumes = klines.map(k => parseFloat(k.volume));
          
          // Calculate technical indicators
          const rsi = calculateRSI(prices);
          const macd = calculateMACD(prices);
          const bbands = calculateBollingerBands(prices);
          const volatility = calculateVolatility(prices);
          const orderFlow = calculateOrderFlow(await binanceClient.getOrderBook(input.symbol));
          
          // Prepare ML input
          const mlInput = {
            prices,
            volumes,
            rsi: Array(prices.length).fill(rsi),
            macd: Array(prices.length).fill(macd),
            bbands: Array(prices.length).fill(bbands),
            orderFlow: Array(prices.length).fill(orderFlow),
            volatility: Array(prices.length).fill(volatility),
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
          };

          // Get ML forecast from advanced engine
          const { EnsemblePredictor } = await import('./ml-prediction-engine');
          const predictor = new EnsemblePredictor();
          const forecast = predictor.predict(mlInput);
          
          return {
            success: true,
            data: {
              symbol: input.symbol,
              timeframe: input.timeframe,
              direction: forecast.direction,
              probability: forecast.probability,
              confidence: forecast.confidence,
              targetPrice: forecast.targetPrice,
              stopLoss: forecast.stopLoss,
              takeProfit: forecast.takeProfit,
              riskRewardRatio: forecast.riskRewardRatio,
              timestamp: Date.now(),
            },
          };
        } catch (error) {
          console.error('[ML Forecast Error]', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'ML forecast failed',
          };
        }
      }),

    orderFlow: publicProcedure
      .input(z.object({
        symbol: z.string(),
        timeframe: z.string().default('1h'),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        try {
          const klines = await binanceClient.getKlines(input.symbol, input.timeframe, input.limit);
          const orderBook = await binanceClient.getOrderBook(input.symbol);
          const ticker = await binanceClient.getTicker(input.symbol);
          
          if (!klines || klines.length === 0) {
            return { success: false, error: 'No kline data available' };
          }

          const currentPrice = parseFloat(ticker.lastPrice);
          const orderFlowMetrics = analyzeOrderFlow(klines as any, orderBook, currentPrice);
          
          return {
            success: true,
            data: {
              symbol: input.symbol,
              timeframe: input.timeframe,
              ...orderFlowMetrics,
              timestamp: Date.now(),
            },
          };
        } catch (error) {
          console.error('[Order Flow Error]', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Order flow analysis failed',
          };
        }
      }),

    unified: publicProcedure
      .input(z.object({
        symbol: z.string(),
        timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1d"]).default("1h"),
        limit: z.number().default(100),
      }))
      .query(async ({ input }) => {
        try {
          const klines = await binanceClient.getKlines(input.symbol, input.timeframe, input.limit);
          const orderBook = await binanceClient.getOrderBook(input.symbol);
          const orderBooks = orderBook ? [orderBook] : [];

          if (!klines || klines.length === 0) {
            return { success: false, error: "No data available" };
          }

          const signal = await analyzeUnifiedSignal(input.symbol, klines, orderBooks);

          return {
            success: true,
            data: signal,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Analysis failed",
          };
        }
      }),

    multiTimeframe: publicProcedure
      .input(z.object({
        symbol: z.string(),
        timeframes: z.array(z.enum(["1h", "4h", "1d"])).default(["1h", "4h", "1d"]),
      }))
      .query(async ({ input }) => {
        try {
          const signals = await Promise.all(
            input.timeframes.map(async (tf) => {
              const klines = await binanceClient.getKlines(input.symbol, tf, 100);
              const orderBook = await binanceClient.getOrderBook(input.symbol);
              const orderBooks = orderBook ? [orderBook] : [];
              if (!klines || klines.length === 0) return null;
              return analyzeUnifiedSignal(input.symbol, klines, orderBooks);
            })
          );

          const validSignals = signals.filter((s) => s !== null);
          if (validSignals.length === 0) {
            return { success: false, error: "No data available" };
          }

          const bullishCount = validSignals.filter((s) => (s as any).decision.includes("BUY")).length;
          const bearishCount = validSignals.filter((s) => (s as any).decision.includes("SELL")).length;
          const avgConfidence = validSignals.reduce((sum, s) => sum + ((s as any).confidence || 0), 0) / validSignals.length;

          let consensusDecision = "HOLD";
          if (bullishCount > bearishCount && avgConfidence >= 0.8) {
            consensusDecision = bullishCount > validSignals.length * 0.66 ? "STRONG_BUY" : "BUY";
          } else if (bearishCount > bullishCount && avgConfidence >= 0.8) {
            consensusDecision = bearishCount > validSignals.length * 0.66 ? "STRONG_SELL" : "SELL";
          }

          return {
            success: true,
            data: {
              symbol: input.symbol,
              timeframes: input.timeframes,
              signals: validSignals,
              consensus: {
                decision: consensusDecision,
                confidence: avgConfidence,
                bullishCount,
                bearishCount,
                timestamp: Date.now(),
              },
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Multi-timeframe analysis failed",
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
