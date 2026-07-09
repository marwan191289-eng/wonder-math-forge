import { create } from "zustand";

export const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];
export const INTERVALS = ["1m", "5m", "15m", "1h", "4h"] as const;
export type Interval = (typeof INTERVALS)[number];

interface DashboardState {
  symbol: string;
  interval: Interval;
  wallThresholdUsd: number;
  setSymbol: (s: string) => void;
  setInterval: (i: Interval) => void;
  setWallThresholdUsd: (v: number) => void;
}

export const useDashboard = create<DashboardState>((set) => ({
  symbol: "BTCUSDT",
  interval: "1m",
  wallThresholdUsd: 500_000,
  setSymbol: (s) => set({ symbol: s.toUpperCase() }),
  setInterval: (i) => set({ interval: i }),
  setWallThresholdUsd: (v) => set({ wallThresholdUsd: v }),
}));
