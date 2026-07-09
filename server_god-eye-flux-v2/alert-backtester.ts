/**
 * Alert Backtesting Service
 * 
 * Validates historical trading signals by:
 * - Replaying triggered alerts against historical price data
 * - Calculating accuracy, win rate, and profitability metrics
 * - Identifying optimal entry/exit levels
 * - Generating strategy performance reports
 */

import { getDb } from './db';
import { triggeredAlerts } from '../drizzle/schema';
import { sql, eq, and, gte, lte } from 'drizzle-orm';

export interface BacktestResult {
  alertId: number;
  symbol: string;
  triggerPrice: number;
  triggerTime: number;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number | null;
  profitLoss: number | null;
  profitLossPercent: number | null;
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING';
  duration: number; // milliseconds
  riskRewardRatio: number | null;
  maxProfit: number | null;
  maxLoss: number | null;
}

export interface BacktestStats {
  totalAlerts: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  pendingCount: number;
  winRate: number; // percentage
  averageProfitLoss: number;
  totalProfitLoss: number;
  profitFactor: number; // gross profit / gross loss
  maxDrawdown: number;
  sharpeRatio: number;
  sortinoRatio: number;
  bestTrade: BacktestResult | null;
  worstTrade: BacktestResult | null;
}

/**
 * Get historical price data for a symbol
 */
async function getHistoricalPrices(
  symbol: string,
  startTime: number,
  endTime: number
): Promise<Array<{ timestamp: number; price: number }>> {
  // This would typically fetch from a price history table or external API
  // For now, return empty array - integrate with your price history storage
  return [];
}

/**
 * Simulate trade execution from alert trigger to exit
 */
async function simulateTrade(
  alert: any,
  historicalPrices: Array<{ timestamp: number; price: number }>
): Promise<BacktestResult> {
  const triggerTime = new Date(alert.createdAt).getTime();
  const triggerPrice = parseFloat(alert.triggerPrice);
  const direction = alert.signal.includes('BUY') ? 'LONG' : 'SHORT';

  // Find entry price (first price after trigger)
  const entryCandle = historicalPrices.find(p => p.timestamp >= triggerTime);
  const entryPrice = entryCandle?.price || triggerPrice;

  // Find exit price (based on take profit or stop loss)
  const takeProfit = parseFloat(alert.targetPrice || '0');
  const stopLoss = parseFloat(alert.stopPrice || '0');

  let exitPrice: number | null = null;
  let exitTime: number | null = null;
  let maxProfit = 0;
  let maxLoss = 0;

  for (const candle of historicalPrices) {
    if (candle.timestamp <= triggerTime) continue;

    const unrealizedPL = direction === 'LONG'
      ? candle.price - entryPrice
      : entryPrice - candle.price;

    maxProfit = Math.max(maxProfit, unrealizedPL);
    maxLoss = Math.min(maxLoss, unrealizedPL);

    // Check exit conditions
    if (direction === 'LONG') {
      if (takeProfit > 0 && candle.price >= takeProfit) {
        exitPrice = takeProfit;
        exitTime = candle.timestamp;
        break;
      }
      if (stopLoss > 0 && candle.price <= stopLoss) {
        exitPrice = stopLoss;
        exitTime = candle.timestamp;
        break;
      }
    } else {
      if (takeProfit > 0 && candle.price <= takeProfit) {
        exitPrice = takeProfit;
        exitTime = candle.timestamp;
        break;
      }
      if (stopLoss > 0 && candle.price >= stopLoss) {
        exitPrice = stopLoss;
        exitTime = candle.timestamp;
        break;
      }
    }
  }

  // Calculate P&L
  let profitLoss: number | null = null;
  let profitLossPercent: number | null = null;
  let outcome: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING' = 'PENDING';

  if (exitPrice !== null && exitTime !== null) {
    profitLoss = direction === 'LONG'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;

    profitLossPercent = (profitLoss / entryPrice) * 100;

    if (profitLoss > 0) outcome = 'WIN';
    else if (profitLoss < 0) outcome = 'LOSS';
    else outcome = 'BREAKEVEN';
  }

  const riskRewardRatio = stopLoss > 0 && takeProfit > 0
    ? Math.abs(takeProfit - entryPrice) / Math.abs(entryPrice - stopLoss)
    : null;

  return {
    alertId: alert.id,
    symbol: alert.symbol,
    triggerPrice,
    triggerTime,
    direction,
    entryPrice,
    exitPrice,
    profitLoss,
    profitLossPercent,
    outcome,
    duration: exitTime ? exitTime - triggerTime : 0,
    riskRewardRatio,
    maxProfit,
    maxLoss,
  };
}

/**
 * Backtest alerts for a specific symbol and time range
 */
export async function backtestAlerts(
  symbol: string,
  startDate: Date,
  endDate: Date
): Promise<{ results: BacktestResult[]; stats: BacktestStats }> {
  const db = await getDb();
  if (!db) return { results: [], stats: calculateStats([]) };

  // Fetch triggered alerts for the symbol in the time range
  const alerts = await db
    .select()
    .from(triggeredAlerts)
    .where(
      and(
        eq(triggeredAlerts.symbol, symbol),
        gte(triggeredAlerts.createdAt, startDate),
        lte(triggeredAlerts.createdAt, endDate)
      )
    );

  // Get historical prices
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const historicalPrices = await getHistoricalPrices(symbol, startTime, endTime);

  // Simulate each trade
  const results: BacktestResult[] = [];
  for (const alert of alerts) {
    const result = await simulateTrade(alert, historicalPrices);
    results.push(result);
  }

  // Calculate statistics
  const stats = calculateStats(results);

  return { results, stats };
}

/**
 * Calculate backtest statistics
 */
function calculateStats(results: BacktestResult[]): BacktestStats {
  const winTrades = results.filter(r => r.outcome === 'WIN');
  const lossTrades = results.filter(r => r.outcome === 'LOSS');
  const breakevenTrades = results.filter(r => r.outcome === 'BREAKEVEN');
  const pendingTrades = results.filter(r => r.outcome === 'PENDING');

  const totalProfitLoss = results.reduce((sum, r) => sum + (r.profitLoss || 0), 0);
  const grossProfit = winTrades.reduce((sum, r) => sum + (r.profitLoss || 0), 0);
  const grossLoss = Math.abs(lossTrades.reduce((sum, r) => sum + (r.profitLoss || 0), 0));

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Calculate max drawdown
  let maxDrawdown = 0;
  let runningProfit = 0;
  let peakProfit = 0;
  for (const result of results) {
    runningProfit += result.profitLoss || 0;
    peakProfit = Math.max(peakProfit, runningProfit);
    const drawdown = peakProfit - runningProfit;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
  }

  // Calculate Sharpe Ratio (simplified)
  const returns = results
    .filter(r => r.profitLossPercent !== null)
    .map(r => r.profitLossPercent!);

  const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b) / returns.length : 0;
  const variance = returns.length > 0
    ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length
    : 0;
  const stdDev = Math.sqrt(variance);
  const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0; // Annualized

  // Calculate Sortino Ratio (only downside volatility)
  const downReturns = returns.filter(r => r < 0);
  const downVariance = downReturns.length > 0
    ? downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downReturns.length
    : 0;
  const downStdDev = Math.sqrt(downVariance);
  const sortinoRatio = downStdDev > 0 ? (meanReturn / downStdDev) * Math.sqrt(252) : 0;

  const bestTrade = results.reduce((best, current) =>
    (current.profitLoss || 0) > (best.profitLoss || 0) ? current : best
  );

  const worstTrade = results.reduce((worst, current) =>
    (current.profitLoss || 0) < (worst.profitLoss || 0) ? current : worst
  );

  return {
    totalAlerts: results.length,
    winCount: winTrades.length,
    lossCount: lossTrades.length,
    breakevenCount: breakevenTrades.length,
    pendingCount: pendingTrades.length,
    winRate: results.length > 0 ? (winTrades.length / results.length) * 100 : 0,
    averageProfitLoss: results.length > 0 ? totalProfitLoss / results.length : 0,
    totalProfitLoss,
    profitFactor,
    maxDrawdown,
    sharpeRatio,
    sortinoRatio,
    bestTrade: bestTrade || null,
    worstTrade: worstTrade || null,
  };
}

/**
 * Get backtest results for a specific alert
 */
export async function getAlertBacktestResult(alertId: number): Promise<BacktestResult | null> {
  const db = await getDb();
  if (!db) return null;

  const alert = await db
    .select()
    .from(triggeredAlerts)
    .where(eq(triggeredAlerts.id, alertId))
    .limit(1);

  if (!alert.length) return null;

  const startDate = new Date(alert[0].createdAt);
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const historicalPrices = await getHistoricalPrices(
    alert[0].symbol,
    startDate.getTime(),
    endDate.getTime()
  );

  return simulateTrade(alert[0], historicalPrices);
}

/**
 * Get performance metrics for a strategy
 */
export async function getStrategyPerformance(
  strategyName: string,
  startDate: Date,
  endDate: Date
): Promise<BacktestStats | null> {
  const db = await getDb();
  if (!db) return null;

  // Fetch alerts for this strategy
  const alerts = await db
    .select()
    .from(triggeredAlerts)
    .where(
      and(
        gte(triggeredAlerts.createdAt, startDate),
        lte(triggeredAlerts.createdAt, endDate)
      )
    );

  if (!alerts.length) return null;

  // For now, use all alerts (strategy filtering can be added based on alertType)
  // Group by symbol and backtest each
  const symbolMap = new Map<string, typeof alerts>();
  for (const alert of alerts) {
    if (!symbolMap.has(alert.symbol)) {
      symbolMap.set(alert.symbol, []);
    }
    symbolMap.get(alert.symbol)!.push(alert);
  }

  // Aggregate results across all symbols
  const allResults: BacktestResult[] = [];
  for (const [symbol, symbolAlerts] of symbolMap) {
    const historicalPrices = await getHistoricalPrices(symbol, startDate.getTime(), endDate.getTime());
    for (const alert of symbolAlerts) {
      const result = await simulateTrade(alert, historicalPrices);
      allResults.push(result);
    }
  }

  return calculateStats(allResults);
}
