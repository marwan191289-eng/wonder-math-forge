// V2 analytics bridge: single entry point that runs the full institutional
// pipeline (book metrics → walls → price metrics → composite score V2).
import type { Depth, Kline } from "@/lib/binance/types";
import {
  computeBookMetrics,
  computePriceMetrics,
  detectLiquidityZones as detectLiquidityZonesV2,
  detectWalls as detectWallsV2,
} from "./analysis";
import { institutionalScoreV2 } from "./institutional-score-v2";

export interface AnalyzeV2Input {
  klines: Kline[];
  depth: Depth;
  prevScore?: number;
  wallThresholdUsd?: number;
  topN?: number;
  emaAlpha?: number;
  wallZThreshold?: number;
  wallDepth?: number;
}

export function analyzeV2({
  klines,
  depth,
  prevScore,
  wallThresholdUsd = 250_000,
  topN = 50,
  emaAlpha = 0.35,
  wallZThreshold = 2.5,
  wallDepth = 200,
}: AnalyzeV2Input) {
  const book = computeBookMetrics(depth, topN);
  const walls = detectWallsV2(depth, book.mid, {
    method: "zscore",
    zThreshold: wallZThreshold,
    absoluteUsd: wallThresholdUsd,
    depth: wallDepth,
    maxPerSide: 8,
  });
  const price = computePriceMetrics(klines);
  const verdict = institutionalScoreV2(book, walls, price, klines, {
    prevScore,
    emaAlpha,
  });
  const zones = detectLiquidityZonesV2(klines, book.mid, { walls });
  return { book, walls, price, verdict, zones };
}


export type AnalyzeV2Result = ReturnType<typeof analyzeV2>;
export {
  computeBookMetrics,
  computePriceMetrics,
  detectWallsV2,
  detectLiquidityZonesV2,
  institutionalScoreV2,
};
