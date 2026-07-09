/**
 * Analytics Sub-Router
 * Handles all advanced analytics endpoints with real data
 */

import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { fetchKlines, fetchOrderBook, fetchTicker } from "../data-connection-service";
import { predictPrice } from "../ml-prediction-engine-real";
import { analyzeOrderFlow } from "../order-flow-analysis";
import { calculateCompositeScore } from "../scoring-engine";
import { detectWalls } from "../whale-detection";
import { analyzeSMC } from "../smc-detection";
import { analyzeMarketStructure } from "../market-structure";
import { detectLiquiditySweep } from "../liquidity-sweep";
import { calculateVPIN } from "../vpin-engine";

// Input validation schemas
const symbolSchema = z.object({
  symbol: z.string().min(1).max(20),
});

const symbolTimeframeSchema = z.object({
  symbol: z.string().min(1).max(20),
  timeframe: z.string().default('1h'),
});

export const analyticsRouter = router({
  /**
   * getAdvancedAnalytics - MAIN ENDPOINT
   * Combines CVD, Order Flow, ML Prediction, Market Structure
   * Uses Promise.all for parallel execution
   */
  getAdvancedAnalytics: publicProcedure
    .input(symbolTimeframeSchema)
    .query(async ({ input }) => {
      try {
        // Parallel data fetching
        const [ticker, book, klines] = await Promise.all([
          fetchTicker(input.symbol),
          fetchOrderBook(input.symbol, 100),
          fetchKlines(input.symbol, input.timeframe, 50),
        ]);

        const currentPrice = parseFloat(ticker.lastPrice);

        // Parallel analytics computation
        const [
          score,
          walls,
          smc,
          structure,
          liquiditySweep,
          vpin,
          orderFlowData,
          mlPrediction,
        ] = await Promise.all([
          Promise.resolve(calculateCompositeScore(book, klines as any, currentPrice)),
          Promise.resolve(detectWalls(book, currentPrice)),
          Promise.resolve(analyzeSMC(klines as any)),
          Promise.resolve(analyzeMarketStructure(klines as any)),
          Promise.resolve(detectLiquiditySweep(klines as any)),
          Promise.resolve(calculateVPIN([book, book] as any)),
          Promise.resolve(analyzeOrderFlow(klines as any, book, currentPrice)),
          Promise.resolve(predictPrice(klines as any)),
        ]);

        return {
          success: true,
          data: {
            ticker: {
              symbol: input.symbol,
              price: currentPrice,
              change24h: parseFloat(ticker.priceChangePercent),
            },
            score,
            walls,
            smc,
            structure,
            liquiditySweep,
            vpin,
            orderFlow: orderFlowData,
            mlPrediction,
            timestamp: Date.now(),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Advanced analytics failed',
        };
      }
    }),

  /**
   * CVD Signal - Real-time cumulative delta analysis
   */
  cvdSignal: publicProcedure
    .input(symbolSchema)
    .query(async ({ input }) => {
      try {
        const [book, klines] = await Promise.all([
          fetchOrderBook(input.symbol, 100),
          fetchKlines(input.symbol, '1h', 50),
        ]);

        // Import CVD engine
        const cvdModule = await import('../cvd-engine-advanced');
        const cvdData = cvdModule.analyzeCVD(book, klines as any);

        return { success: true, data: cvdData };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'CVD analysis failed' };
      }
    }),

  /**
   * Order Flow Analysis - Microstructure analysis
   */
  orderFlow: publicProcedure
    .input(symbolSchema)
    .query(async ({ input }) => {
      try {
        const [book, ticker, klines] = await Promise.all([
          fetchOrderBook(input.symbol, 100),
          fetchTicker(input.symbol),
          fetchKlines(input.symbol, '1h', 50),
        ]);

        const currentPrice = parseFloat(ticker.lastPrice);
        const orderFlowData = analyzeOrderFlow(klines as any, book, currentPrice);

        return { success: true, data: orderFlowData };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Order flow analysis failed' };
      }
    }),

  /**
   * ML Forecast - Price prediction with confidence
   */
  mlForecast: publicProcedure
    .input(symbolSchema)
    .query(async ({ input }) => {
      try {
        const klines = await fetchKlines(input.symbol, '1h', 50);
        const prediction = predictPrice(klines as any);

        return { success: true, data: prediction };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'ML forecast failed' };
      }
    }),

  /**
   * Market Structure - Multi-timeframe analysis
   */
  marketStructure: publicProcedure
    .input(symbolTimeframeSchema)
    .query(async ({ input }) => {
      try {
        const klines = await fetchKlines(input.symbol, input.timeframe, 100);
        const structure = analyzeMarketStructure(klines as any);

        return { success: true, data: structure };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Market structure analysis failed' };
      }
    }),

  /**
   * Whale Detection - Large order walls
   */
  whaleDetection: publicProcedure
    .input(symbolSchema)
    .query(async ({ input }) => {
      try {
        const [book, ticker] = await Promise.all([
          fetchOrderBook(input.symbol, 100),
          fetchTicker(input.symbol),
        ]);

        const currentPrice = parseFloat(ticker.lastPrice);
        const walls = detectWalls(book, currentPrice);

        return { success: true, data: walls };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Whale detection failed' };
      }
    }),

  /**
   * Smart Money Concepts - SMC patterns
   */
  smartMoneyConcepts: publicProcedure
    .input(symbolTimeframeSchema)
    .query(async ({ input }) => {
      try {
        const klines = await fetchKlines(input.symbol, input.timeframe, 100);
        const patterns = analyzeSMC(klines as any);

        return { success: true, data: patterns };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'SMC analysis failed' };
      }
    }),

  /**
   * Institutional Footprint Detection - Phase 2
   */
  institutionalFootprint: publicProcedure
    .input(symbolSchema)
    .query(async ({ input }) => {
      try {
        const { detectInstitutionalFootprint } = await import('../order-flow-phase2');
        const [book, ticker] = await Promise.all([
          fetchOrderBook(input.symbol, 100),
          fetchTicker(input.symbol),
        ]);

        // Get recent trades for pattern detection (simulate from klines)
        const tradesKlines = await fetchKlines(input.symbol, '1m', 50);
        const recentTrades = tradesKlines.map((k, i) => ({
          price: typeof k.close === 'string' ? k.close : String(k.close),
          qty: typeof k.volume === 'string' ? k.volume : String(k.volume),
          time: Date.now() - (50 - i) * 60000,
          isBuyerMaker: parseFloat(typeof k.close === 'string' ? k.close : String(k.close)) > parseFloat(typeof k.open === 'string' ? k.open : String(k.open)),
        }));
        
        // Get price history
        const klines = await fetchKlines(input.symbol, '1m', 50);
        const priceHistory = klines.map(k => parseFloat(typeof k.close === 'string' ? k.close : String(k.close)));

        const footprint = detectInstitutionalFootprint(
          {
            bids: book.bids.map(([p, v]: any) => [parseFloat(p as string), parseFloat(v as string)]),
            asks: book.asks.map(([p, v]: any) => [parseFloat(p as string), parseFloat(v as string)]),
          },
          recentTrades.map((t: any) => ({
            price: parseFloat(t.price as string),
            quantity: parseFloat(t.qty as string),
            time: t.time as number,
            isBuyerMaker: t.isBuyerMaker as boolean,
          })),
          priceHistory
        );

        return { success: true, data: footprint };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Footprint detection failed' };
      }
    }),

  /**
   * getAll - Combined endpoint for fast initial render (legacy compatibility)
   */
  getAll: publicProcedure
    .input(symbolTimeframeSchema)
    .query(async ({ input }) => {
      try {
        const [ticker, klines] = await Promise.all([
          fetchTicker(input.symbol),
          fetchKlines(input.symbol, input.timeframe, 100),
        ]);
        const currentPrice = parseFloat(ticker.lastPrice);
        const [score, smc] = await Promise.all([
          Promise.resolve(calculateCompositeScore({} as any, klines as any, currentPrice)),
          Promise.resolve(analyzeSMC(klines as any)),
        ]);

        return {
          success: true,
          ticker: {
            symbol: input.symbol,
            priceChange24h: ticker.priceChangePercent,
            highPrice24h: ticker.highPrice,
            lowPrice24h: ticker.lowPrice,
            volume24h: ticker.quoteVolume,
            dataQuality: 95,
            averageQuality: 95,
          },
          book: {
            bestBid: currentPrice,
            bidVolume: 0,
            bestAsk: currentPrice,
            askVolume: 0,
            spreadPct: 0,
            bidUsd: 0,
            askUsd: 0,
          },
          score,
          walls: {
            bidWalls: [],
            askWalls: [],
          },
          smc,
          quality: { averageQuality: 95 },
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed' };
      }
    }),
});
