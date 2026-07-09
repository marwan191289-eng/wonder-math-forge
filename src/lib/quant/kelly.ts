// Kelly criterion for binary bets:
//   f* = (b p - q) / b     where b = win/loss ratio, p = win prob, q = 1-p
// Volatility-adjusted Kelly: scale by (targetVol / currentVol), capped.
export function kellyFraction(winProb: number, winLossRatio: number): number {
  const p = Math.max(0, Math.min(1, winProb));
  const q = 1 - p;
  const b = Math.max(1e-6, winLossRatio);
  const f = (b * p - q) / b;
  return Math.max(0, f);
}

export interface KellySizingResult {
  kellyFraction: number;
  adjustedFraction: number;
  positionUSD: number;
  suggestedLeverage: number;
  volatilityRegime: "low" | "medium" | "high";
}

export function riskAdjustedSize(params: {
  balance: number;
  winProb: number;
  winLossRatio: number;
  currentAnnualVol: number; // e.g. 0.60 = 60% annualized
  targetAnnualVol?: number; // default 0.20
  fractionalKelly?: number; // 0..1, default 0.5 (half-Kelly)
  maxLeverage?: number;     // default 5
}): KellySizingResult {
  const {
    balance, winProb, winLossRatio, currentAnnualVol,
    targetAnnualVol = 0.2, fractionalKelly = 0.5, maxLeverage = 5,
  } = params;
  const kelly = kellyFraction(winProb, winLossRatio);
  const volScale = currentAnnualVol > 0 ? Math.min(1, targetAnnualVol / currentAnnualVol) : 1;
  const adj = kelly * fractionalKelly * volScale;
  const capped = Math.min(adj, 1);
  const regime: "low" | "medium" | "high" =
    currentAnnualVol < 0.3 ? "low" : currentAnnualVol < 0.8 ? "medium" : "high";
  const leverage = Math.max(1, Math.min(maxLeverage, maxLeverage * volScale));
  return {
    kellyFraction: kelly,
    adjustedFraction: capped,
    positionUSD: balance * capped,
    suggestedLeverage: leverage,
    volatilityRegime: regime,
  };
}
