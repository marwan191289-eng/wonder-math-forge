// utils/math.ts

import { Candle } from '../engine/types';

export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;
  let atr = 0;
  let sum = 0;
  
  // ✅ M5: إصلاح Wilder's Smoothing
  // أولاً: حساب متوسط TR للفترة الأولى
  for (let i = 1; i <= period; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i-1].close),
      Math.abs(candles[i].low - candles[i-1].close)
    );
    sum += tr;
  }
  atr = sum / period;
  
  // ثم: Wilder's Smoothing للفترات التالية
  for (let i = period + 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i-1].close),
      Math.abs(candles[i].low - candles[i-1].close)
    );
    atr = ((atr * (period - 1)) + tr) / period;
  }
  
  return atr;
}

export function fibonacciScore(actual: number, ideal: number, tolerance = 0.18, sharpness = 2.2): number {
  const dev = Math.abs(actual - ideal) / ideal;
  return Math.max(0, Math.exp(-Math.pow(dev / tolerance, sharpness))) * 100;
}

export function zScore(value: number, mean: number, std: number): number {
  return std > 0 ? (value - mean) / std : 0;
}

export function calculateSmaSlope(values: number[], period: number = 20): number {
  if (values.length < period) return 0;
  const start = values.slice(-period)[0];
  const end = values[values.length - 1];
  return (end - start) / start;
}

export function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / (values.length || 1);
}

export function stdDev(values: number[], meanVal?: number): number {
  const m = meanVal ?? mean(values);
  const variance = values.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (values.length || 1);
  return Math.sqrt(variance);
}

export function precomputeAvgVolume(candles: Candle[], period: number = 20): number[] {
  const n = candles.length;
  if (n === 0) return [];
  if (n < period) {
    const result: number[] = [];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += candles[i].volume;
      result.push(sum / (i + 1));
    }
    return result;
  }

  const result: number[] = new Array(n);
  let windowSum = 0;

  for (let i = 0; i < period; i++) {
    windowSum += candles[i].volume;
  }
  result[period - 1] = windowSum / period;

  for (let i = period; i < n; i++) {
    windowSum = windowSum - candles[i - period].volume + candles[i].volume;
    result[i] = windowSum / period;
  }

  for (let i = 0; i < period - 1; i++) {
    result[i] = result[period - 1];
  }

  return result;
}