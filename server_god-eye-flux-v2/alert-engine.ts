/**
 * FLUX Alert Engine
 * Evaluates user-configured thresholds against live market data.
 * Fires push notifications via Manus owner-notifications API.
 * All alerts and history persisted to MySQL.
 */

import { getDb } from './db';
import { userAlerts, alertHistory } from '../drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { ENV } from './_core/env';

// ── Alert evaluation ──────────────────────────────────────────────────────────
export interface MarketSnapshot {
  symbol: string;
  price: number;
  score: number;
  confidence: number;
  regime: string;
  bookImbalance: number;
  wallPressure: number;
  cvdSignal: number;
  ofiSignal: number;
  maxWallSizeUsd: number;
  stopHuntProbability: number;
}

const ALERT_LABELS: Record<string, { en: string; ar: string }> = {
  score_above:           { en: 'Score exceeded threshold',        ar: 'تجاوز المؤشر الحد المحدد' },
  score_below:           { en: 'Score dropped below threshold',   ar: 'انخفض المؤشر تحت الحد المحدد' },
  price_above:           { en: 'Price exceeded threshold',        ar: 'تجاوز السعر الحد المحدد' },
  price_below:           { en: 'Price dropped below threshold',   ar: 'انخفض السعر تحت الحد المحدد' },
  wall_size_above:       { en: 'Large wall detected',             ar: 'تم اكتشاف جدار سعري كبير' },
  imbalance_above:       { en: 'High buy imbalance detected',     ar: 'اختلال شرائي مرتفع' },
  imbalance_below:       { en: 'High sell imbalance detected',    ar: 'اختلال بيعي مرتفع' },
  stop_hunt_probability: { en: 'Stop hunt risk elevated',         ar: 'خطر صيد الستوبات مرتفع' },
  cvd_divergence:        { en: 'CVD divergence detected',         ar: 'تباين CVD مكتشف' },
  regime_change:         { en: 'Market regime changed',           ar: 'تغير نظام السوق' },
};

function getActualValue(snapshot: MarketSnapshot, alertType: string): number {
  switch (alertType) {
    case 'score_above':
    case 'score_below':           return snapshot.score;
    case 'price_above':
    case 'price_below':           return snapshot.price;
    case 'wall_size_above':       return snapshot.maxWallSizeUsd;
    case 'imbalance_above':
    case 'imbalance_below':       return snapshot.bookImbalance * 100;
    case 'stop_hunt_probability': return snapshot.stopHuntProbability;
    case 'cvd_divergence':        return Math.abs(snapshot.cvdSignal);
    default:                      return 0;
  }
}

function isTriggered(alertType: string, actual: number, threshold: number): boolean {
  switch (alertType) {
    case 'score_above':
    case 'price_above':
    case 'wall_size_above':
    case 'imbalance_above':
    case 'stop_hunt_probability':
    case 'cvd_divergence':        return actual >= threshold;
    case 'score_below':
    case 'price_below':
    case 'imbalance_below':       return actual <= threshold;
    default:                      return false;
  }
}

function buildMessage(alertType: string, symbol: string, actual: number, threshold: number): { en: string; ar: string } {
  const label = ALERT_LABELS[alertType] ?? { en: alertType, ar: alertType };
  return {
    en: `[GOD-EYE] ${symbol}: ${label.en} — Value: ${actual.toFixed(2)} (threshold: ${threshold})`,
    ar: `[FLUX] ${symbol}: ${label.ar} — القيمة: ${actual.toFixed(2)} (الحد: ${threshold})`,
  };
}

// ── Push notification via Manus owner-notifications ───────────────────────────
async function sendPushNotification(title: string, body: string): Promise<void> {
  try {
    const apiUrl = process.env.BUILT_IN_FORGE_API_URL;
    const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
    if (!apiUrl || !apiKey) return;

    await fetch(`${apiUrl}/notification/owner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ title, body }),
    });
  } catch {
    // Notification failure is non-fatal
  }
}

// ── Main evaluation loop ──────────────────────────────────────────────────────
export async function evaluateAlerts(snapshot: MarketSnapshot): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const activeAlerts = await db
      .select()
      .from(userAlerts)
      .where(and(
        eq(userAlerts.symbol, snapshot.symbol),
        eq(userAlerts.isActive, true)
      ));

    for (const alert of activeAlerts) {
      const threshold = parseFloat(alert.threshold);
      const actual = getActualValue(snapshot, alert.alertType);

      if (!isTriggered(alert.alertType, actual, threshold)) continue;

      // Skip if alert was already triggered recently (5 min cooldown to prevent duplicate notifications)
      if (alert.triggeredAt) {
        const timeSinceTrigger = Date.now() - alert.triggeredAt.getTime();
        if (timeSinceTrigger < 5 * 60 * 1000) {
          continue; // Alert already fired, skip
        }
      }

      const msgs = buildMessage(alert.alertType, snapshot.symbol, actual, threshold);

      // Record in alert_history
      await db.insert(alertHistory).values({
        alertId: alert.id,
        symbol: snapshot.symbol,
        alertType: alert.alertType,
        threshold: alert.threshold,
        actualValue: actual.toFixed(4),
        message: msgs.en,
        messageAr: msgs.ar,
      });

      // Update the alert record
      await db.update(userAlerts)
        .set({
          triggeredAt: new Date(),
          triggeredValue: actual.toFixed(4),
          notificationSent: true,
        })
        .where(eq(userAlerts.id, alert.id));

      // Send push notification
      await sendPushNotification(`GOD-EYE Alert: ${snapshot.symbol}`, msgs.en);
    }
  } catch (err) {
    console.error('[AlertEngine] Evaluation error:', err);
  }
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────
export async function createAlert(data: {
  userId?: number;
  symbol: string;
  alertType: string;
  threshold: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database unavailable');

  const msgs = buildMessage(data.alertType, data.symbol, data.threshold, data.threshold);
  const result = await db.insert(userAlerts).values({
    userId: data.userId ?? null,
    symbol: data.symbol,
    alertType: data.alertType as any,
    threshold: data.threshold.toFixed(4),
    message: msgs.en,
    messageAr: msgs.ar,
    isActive: true,
  });

  return (result as any).insertId ?? 0;
}

export async function listAlerts(symbol?: string): Promise<typeof userAlerts.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  if (symbol) {
    return db.select().from(userAlerts).where(eq(userAlerts.symbol, symbol));
  }
  return db.select().from(userAlerts);
}

export async function deleteAlert(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(userAlerts).set({ isActive: false }).where(eq(userAlerts.id, id));
}

export async function getAlertHistory(symbol?: string, limit = 50): Promise<typeof alertHistory.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db.select().from(alertHistory).limit(limit);
  return symbol ? rows.filter(r => r.symbol === symbol) : rows;
}

// ── Background alert evaluation loop ──────────────────────────────────────────
// Runs every 30 seconds to evaluate all active alerts against latest market data
// This ensures alerts fire even when no active users are viewing the dashboard

import { binanceClient } from './binance-client';
import { calculateCompositeScore } from './scoring-engine';
import { detectWalls } from './whale-detection';

let alertLoopRunning = false;

export async function startBackgroundAlertLoop(): Promise<void> {
  if (alertLoopRunning) return;
  alertLoopRunning = true;

  const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'LTCUSDT', 'ETCUSDT'];
  const EVAL_INTERVAL = 30000; // 30 seconds

  const runEvaluation = async () => {
    try {
      for (const symbol of SYMBOLS) {
        try {
          const [ticker, book, klines] = await Promise.all([
            binanceClient.getTicker(symbol),
            binanceClient.getOrderBook(symbol, 100),
            binanceClient.getKlines(symbol, '1h', 50),
          ]);

          const currentPrice = parseFloat(ticker.lastPrice);
          const score = calculateCompositeScore(book, klines as any, currentPrice);
          const walls = detectWalls(book, currentPrice);

          const maxWallUsd = Math.max(
            ...(walls.bidWalls ?? []).map((w: any) => w.valueUsd ?? 0),
            ...(walls.askWalls ?? []).map((w: any) => w.valueUsd ?? 0),
            0
          );

          const snapshot: MarketSnapshot = {
            symbol,
            price: currentPrice,
            score: score.score,
            confidence: score.confidence,
            regime: score.regime,
            bookImbalance: score.components.bookImbalance,
            wallPressure: score.components.wallPressure,
            cvdSignal: score.components.cvdSignal,
            ofiSignal: score.components.ofiSignal,
            maxWallSizeUsd: maxWallUsd,
            stopHuntProbability: 0, // Not available in CompositeScore
          };

          // Evaluate alerts for this symbol
          await evaluateAlerts(snapshot);
        } catch (err) {
          console.error(`[AlertLoop] Error evaluating ${symbol}:`, err);
        }
      }
    } catch (err) {
      console.error('[AlertLoop] Evaluation cycle failed:', err);
    }

    // Schedule next evaluation
    setTimeout(runEvaluation, EVAL_INTERVAL);
  };

  // Start the loop
  console.log('[AlertLoop] Background alert evaluation loop started (30s interval)');
  setTimeout(runEvaluation, EVAL_INTERVAL);
}

// Auto-start on module load
startBackgroundAlertLoop().catch(err => console.error('[AlertLoop] Failed to start:', err));
