// Live-tunable V2 engine settings. Persisted to localStorage so operators can
// tweak proximity/wall/EMA/ATR params without a redeploy.
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface V2Settings {
  emaAlpha: number;          // score EMA smoothing (0..1)
  wallZThreshold: number;    // z-score threshold for wall detection
  wallDepth: number;         // levels considered per side
  topN: number;              // top-N depth levels for book metrics
  atrPeriod: number;         // ATR period (surfaced for UI; consumed by engine)
  wallThresholdUsd: number;  // absolute USD floor for wall qualification
}

interface V2SettingsState extends V2Settings {
  set: <K extends keyof V2Settings>(key: K, value: V2Settings[K]) => void;
  reset: () => void;
}

export const V2_DEFAULTS: V2Settings = {
  emaAlpha: 0.35,
  wallZThreshold: 2.5,
  wallDepth: 200,
  topN: 50,
  atrPeriod: 14,
  wallThresholdUsd: 250_000,
};

export const useV2Settings = create<V2SettingsState>()(
  persist(
    (set) => ({
      ...V2_DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<V2SettingsState>),
      reset: () => set({ ...V2_DEFAULTS }),
    }),
    { name: "whaleeye:v2-settings" },
  ),
);
