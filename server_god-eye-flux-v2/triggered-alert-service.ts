import { getDb } from "./db";
import { triggeredAlerts } from "../drizzle/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import type { InsertTriggeredAlert } from "../drizzle/schema";

export interface AlertTriggerInput {
  userId: number;
  symbol: string;
  alertType: "bos_break" | "liquidity_sweep" | "vpin_toxicity";
  severity: "low" | "medium" | "high" | "critical";
  threshold: number;
  message?: string;
  messageAr?: string;
  pattern?: string;
  trendStrength?: number;
  sweepProbability?: number;
  vpinValue?: number;
  vpinToxicity?: string;
}

/**
 * Create a triggered alert in the database
 */
export async function createTriggeredAlert(input: AlertTriggerInput) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const alert = await db.insert(triggeredAlerts).values({
      userId: input.userId,
      symbol: input.symbol,
      alertType: input.alertType,
      severity: input.severity,
      threshold: input.threshold.toString(),
      pattern: input.pattern,
      trendStrength: input.trendStrength ? input.trendStrength.toString() : undefined,
      sweepProbability: input.sweepProbability ? input.sweepProbability.toString() : undefined,
      vpinValue: input.vpinValue ? input.vpinValue.toString() : undefined,
      vpinToxicity: input.vpinToxicity,
      message: input.message,
      messageAr: input.messageAr,
    } as InsertTriggeredAlert);

    return { success: true, alertId: alert[0].insertId };
  } catch (error) {
    console.error("Failed to create triggered alert:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get alert history for a user
 */
export async function getUserAlerts(userId: number, limit: number = 100, offset: number = 0) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const alerts = await db
      .select()
      .from(triggeredAlerts)
      .where(eq(triggeredAlerts.userId, userId))
      .orderBy(desc(triggeredAlerts.triggeredAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select()
      .from(triggeredAlerts)
      .where(eq(triggeredAlerts.userId, userId));

    return { success: true, data: alerts, total: total.length };
  } catch (error) {
    console.error("Failed to fetch user alerts:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get alerts for a specific symbol
 */
export async function getSymbolAlerts(userId: number, symbol: string, limit: number = 50) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const alerts = await db
      .select()
      .from(triggeredAlerts)
      .where(and(eq(triggeredAlerts.userId, userId), eq(triggeredAlerts.symbol, symbol)))
      .orderBy(desc(triggeredAlerts.triggeredAt))
      .limit(limit);

    return { success: true, data: alerts };
  } catch (error) {
    console.error("Failed to fetch symbol alerts:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Mark alert as read
 */
export async function markAlertAsRead(alertId: number, userId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(triggeredAlerts)
      .set({ isRead: true })
      .where(and(eq(triggeredAlerts.id, alertId), eq(triggeredAlerts.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error("Failed to mark alert as read:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Mark alert as acknowledged
 */
export async function acknowledgeAlert(alertId: number, userId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(triggeredAlerts)
      .set({ isAcknowledged: true })
      .where(and(eq(triggeredAlerts.id, alertId), eq(triggeredAlerts.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error("Failed to acknowledge alert:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Record alert outcome (when user records profit/loss)
 */
export async function recordAlertOutcome(
  alertId: number,
  userId: number,
  outcome: "profitable" | "breakeven" | "loss",
  outcomePrice?: number,
  profitLoss?: number
) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(triggeredAlerts)
      .set({
        outcome,
        outcomePrice: outcomePrice ? outcomePrice.toString() : undefined,
        outcomeTime: new Date(),
        profitLoss: profitLoss ? profitLoss.toString() : undefined,
      })
      .where(and(eq(triggeredAlerts.id, alertId), eq(triggeredAlerts.userId, userId)));

    return { success: true };
  } catch (error) {
    console.error("Failed to record alert outcome:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get alert statistics for a user
 */
export async function getAlertStats(userId: number) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const allAlerts = await db
      .select()
      .from(triggeredAlerts)
      .where(eq(triggeredAlerts.userId, userId));

    const total = allAlerts.length;
    const unread = allAlerts.filter((a: any) => !a.isRead).length;
    const acknowledged = allAlerts.filter((a: any) => a.isAcknowledged).length;
    const profitable = allAlerts.filter((a: any) => a.outcome === "profitable").length;
    const loss = allAlerts.filter((a: any) => a.outcome === "loss").length;
    const pending = allAlerts.filter((a: any) => a.outcome === "pending").length;

    const totalProfitLoss = allAlerts
      .filter((a: any) => a.profitLoss)
      .reduce((sum: number, a: any) => sum + parseFloat(a.profitLoss || "0"), 0);

    const byType = {
      bos_break: allAlerts.filter((a: any) => a.alertType === "bos_break").length,
      liquidity_sweep: allAlerts.filter((a: any) => a.alertType === "liquidity_sweep").length,
      vpin_toxicity: allAlerts.filter((a: any) => a.alertType === "vpin_toxicity").length,
    };

    const accuracy = total > 0 ? ((profitable / total) * 100).toFixed(2) : "0";

    return {
      success: true,
      data: {
        total,
        unread,
        acknowledged,
        profitable,
        loss,
        pending,
        totalProfitLoss,
        accuracy: parseFloat(accuracy),
        byType,
      },
    };
  } catch (error) {
    console.error("Failed to get alert stats:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Get recent alerts (last 24 hours)
 */
export async function getRecentAlerts(userId: number, hoursBack: number = 24) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const alerts = await db
      .select()
      .from(triggeredAlerts)
      .where(
        and(eq(triggeredAlerts.userId, userId), gte(triggeredAlerts.triggeredAt, cutoffTime))
      )
      .orderBy(desc(triggeredAlerts.triggeredAt));

    return { success: true, data: alerts };
  } catch (error) {
    console.error("Failed to fetch recent alerts:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
