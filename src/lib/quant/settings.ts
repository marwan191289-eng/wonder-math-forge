import { create } from "zustand";

export interface QuantSettings {
  // Global
  marketSpeedMs: number;         // tick interval
  baseVolatility: number;         // annualized
  live: boolean;                 // Live/Simulated toggle (always simulated)
  // Kalman
  kalmanQ: number;               // process noise
  kalmanR: number;               // measurement noise (fixed)
  // Hurst
  hurstWindow: number;
  // Hawkes
  hawkesMu: number;
  hawkesAlpha: number;
  hawkesBeta: number;
  // GARCH
  garchOmega: number;
  garchAlpha: number;
  garchBeta: number;
  // Sizer
  balance: number;
  winProb: number;
  winLossRatio: number;
  fractionalKelly: number;
  maxLeverage: number;
  targetAnnualVol: number;
}

interface Actions {
  set: <K extends keyof QuantSettings>(k: K, v: QuantSettings[K]) => void;
  reset: () => void;
}

const defaults: QuantSettings = {
  marketSpeedMs: 1200,
  baseVolatility: 0.6,
  live: false,
  kalmanQ: 5e-4,
  kalmanR: 1,
  hurstWindow: 128,
  hawkesMu: 0.5,
  hawkesAlpha: 0.85,
  hawkesBeta: 1.2,
  garchOmega: 1e-6,
  garchAlpha: 0.08,
  garchBeta: 0.9,
  balance: 100_000,
  winProb: 0.55,
  winLossRatio: 1.8,
  fractionalKelly: 0.5,
  maxLeverage: 5,
  targetAnnualVol: 0.2,
};

export const useQuantSettings = create<QuantSettings & Actions>((set) => ({
  ...defaults,
  set: (k, v) => set({ [k]: v } as Partial<QuantSettings>),
  reset: () => set(defaults),
}));
