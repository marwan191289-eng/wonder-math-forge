/**
 * Alert Service
 * Manages alert creation, persistence, and user notifications
 */

import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { alerts, type Alert } from '../drizzle/schema';

export interface AlertConfig {
  scoreThreshold: number;
  wallSizeThreshold: number;
  imbalanceThreshold: number;
  stopHuntProbability: number;
}

export interface AlertTrigger {
  type: 'score' | 'wall' | 'imbalance' | 'stop_hunt' | 'smc' | 'regime_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  symbol: string;
  value?: number;
}

/**
 * Create and persist an alert
 */
export async function createAlert(userId: number, trigger: AlertTrigger): Promise<Alert | null> {
  const db = await getDb();
  if (!db) {
    console.warn('[AlertService] Database not available');
    return null;
  }

  try {
    const result = await db
      .insert(alerts)
      .values({
        userId,
        symbol: trigger.symbol,
        type: trigger.type,
        severity: trigger.severity,
        title: trigger.title,
        titleAr: trigger.titleAr,
        message: trigger.message,
        messageAr: trigger.messageAr,
        isRead: false,
      })
      .execute();

    console.log(`[AlertService] Alert created for user ${userId}: ${trigger.title}`);
    return {
      id: 0,
      userId,
      symbol: trigger.symbol,
      type: trigger.type,
      severity: trigger.severity,
      title: trigger.title,
      titleAr: trigger.titleAr,
      message: trigger.message,
      messageAr: trigger.messageAr,
      isRead: false,
      createdAt: new Date(),
    };
  } catch (error) {
    console.error('[AlertService] Failed to create alert:', error);
    return null;
  }
}

/**
 * Check if alert should be triggered based on score
 */
export function shouldTriggerScoreAlert(
  currentScore: number,
  previousScore: number,
  threshold: number
): boolean {
  // Trigger if crossing threshold
  const crossedUp = previousScore < threshold && currentScore >= threshold;
  const crossedDown = previousScore > -threshold && currentScore <= -threshold;

  return crossedUp || crossedDown;
}

/**
 * Check if alert should be triggered based on wall size
 */
export function shouldTriggerWallAlert(
  wallUsd: number,
  threshold: number,
  previousWallUsd: number = 0
): boolean {
  // Trigger if wall exceeds threshold and is new or significantly larger
  return wallUsd > threshold && wallUsd > previousWallUsd * 1.5;
}

/**
 * Check if alert should be triggered based on imbalance
 */
export function shouldTriggerImbalanceAlert(
  imbalance: number,
  threshold: number
): boolean {
  // Trigger if imbalance exceeds threshold
  return Math.abs(imbalance) > threshold;
}

/**
 * Generate score alert
 */
export function generateScoreAlert(score: number, symbol: string): AlertTrigger | null {
  if (score > 70) {
    return {
      type: 'score',
      severity: 'high',
      title: `Strong Bullish Signal on ${symbol}`,
      titleAr: `إشارة صعودية قوية على ${symbol}`,
      message: `Institutional score reached ${score.toFixed(0)}. Strong buying pressure detected.`,
      messageAr: `وصلت درجة المؤسسة إلى ${score.toFixed(0)}. تم اكتشاف ضغط شراء قوي.`,
      symbol,
      value: score,
    };
  } else if (score < -70) {
    return {
      type: 'score',
      severity: 'high',
      title: `Strong Bearish Signal on ${symbol}`,
      titleAr: `إشارة هبوطية قوية على ${symbol}`,
      message: `Institutional score reached ${score.toFixed(0)}. Strong selling pressure detected.`,
      messageAr: `وصلت درجة المؤسسة إلى ${score.toFixed(0)}. تم اكتشاف ضغط بيع قوي.`,
      symbol,
      value: score,
    };
  }

  return null;
}

/**
 * Generate wall alert
 */
export function generateWallAlert(wallUsd: number, symbol: string, type: 'bid' | 'ask'): AlertTrigger {
  const wallType = type === 'bid' ? 'Bid Wall' : 'Ask Wall';
  const wallTypeAr = type === 'bid' ? 'جدار الطلب' : 'جدار العرض';

  return {
    type: 'wall',
    severity: wallUsd > 5000000 ? 'critical' : wallUsd > 2000000 ? 'high' : 'medium',
    title: `Massive ${wallType} Detected on ${symbol}`,
    titleAr: `تم اكتشاف ${wallTypeAr} ضخم على ${symbol}`,
    message: `${wallType} of $${(wallUsd / 1000000).toFixed(2)}M detected. Whale activity likely.`,
    messageAr: `تم اكتشاف ${wallTypeAr} بقيمة $${(wallUsd / 1000000).toFixed(2)}M. نشاط الحيتان محتمل.`,
    symbol,
    value: wallUsd,
  };
}

/**
 * Generate imbalance alert
 */
export function generateImbalanceAlert(imbalance: number, symbol: string): AlertTrigger {
  const direction = imbalance > 0 ? 'Buy' : 'Sell';
  const directionAr = imbalance > 0 ? 'شراء' : 'بيع';

  return {
    type: 'imbalance',
    severity: Math.abs(imbalance) > 0.6 ? 'high' : 'medium',
    title: `Extreme ${direction} Imbalance on ${symbol}`,
    titleAr: `عدم توازن ${directionAr} متطرف على ${symbol}`,
    message: `Order book imbalance reached ${(Math.abs(imbalance) * 100).toFixed(0)}%. ${direction} pressure is extreme.`,
    messageAr: `وصل عدم توازن دفتر الطلبات إلى ${(Math.abs(imbalance) * 100).toFixed(0)}%. ضغط ${directionAr} متطرف.`,
    symbol,
    value: imbalance,
  };
}

/**
 * Generate stop-hunt alert
 */
export function generateStopHuntAlert(symbol: string, level: number, probability: number): AlertTrigger {
  return {
    type: 'stop_hunt',
    severity: probability > 0.7 ? 'high' : 'medium',
    title: `Potential Stop Hunt on ${symbol}`,
    titleAr: `احتمال صيد الإيقاف على ${symbol}`,
    message: `Stop hunt probability at $${level.toFixed(2)} is ${(probability * 100).toFixed(0)}%. Price may briefly break level.`,
    messageAr: `احتمالية صيد الإيقاف عند $${level.toFixed(2)} هي ${(probability * 100).toFixed(0)}%. قد يخترق السعر المستوى مؤقتاً.`,
    symbol,
    value: probability,
  };
}

/**
 * Generate SMC alert
 */
export function generateSMCAlert(symbol: string, pattern: string, patternAr: string): AlertTrigger {
  return {
    type: 'smc',
    severity: 'medium',
    title: `SMC Pattern: ${pattern} on ${symbol}`,
    titleAr: `نمط SMC: ${patternAr} على ${symbol}`,
    message: `${pattern} detected. Key support/resistance level identified.`,
    messageAr: `تم اكتشاف ${patternAr}. تم تحديد مستوى دعم/مقاومة رئيسي.`,
    symbol,
  };
}

/**
 * Generate regime change alert
 */
export function generateRegimeChangeAlert(
  symbol: string,
  newRegime: string,
  newRegimeAr: string
): AlertTrigger {
  return {
    type: 'regime_change',
    severity: 'medium',
    title: `Market Regime Change on ${symbol}`,
    titleAr: `تغيير نظام السوق على ${symbol}`,
    message: `Market has shifted to ${newRegime} regime. Adjust strategy accordingly.`,
    messageAr: `تحول السوق إلى نظام ${newRegimeAr}. اضبط الاستراتيجية وفقاً لذلك.`,
    symbol,
  };
}

/**
 * Get user's unread alerts
 */
export async function getUserUnreadAlerts(userId: number): Promise<Alert[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId) && eq(alerts.isRead, false))
      .execute();

    return result;
  } catch (error) {
    console.error('[AlertService] Failed to fetch unread alerts:', error);
    return [];
  }
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(alertId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;

  try {
    await db
      .update(alerts)
      .set({ isRead: true })
      .where(eq(alerts.id, alertId))
      .execute();

    return true;
  } catch (error) {
    console.error('[AlertService] Failed to mark alert as read:', error);
    return false;
  }
}

/**
 * Get alert history for user
 */
export async function getAlertHistory(userId: number, limit: number = 50): Promise<Alert[]> {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(alerts.createdAt)
      .limit(limit)
      .execute();

    return result;
  } catch (error) {
    console.error('[AlertService] Failed to fetch alert history:', error);
    return [];
  }
}
