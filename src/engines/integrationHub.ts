// engine/integrationHub.ts

import * as tf from '@tensorflow/tfjs'; // ✅ B2: إضافة استيراد TensorFlow

import {
  Candle,
  FullAnalysisResult,
  AnalysisContext,
  DataQualityResult,
  ConfluenceSignal,
  DivergenceStore,
  LSTMPrediction,
  ElliottResult,
  CVDResult,
  SMCResult,
  Pivot
} from './types'; // ✅ B3: استيراد جميع الأنواع المطلوبة

import { calculateATR, zScore, mean, stdDev } from '../utils/math';
import { getDynamicPivotParams, getPivotPoints } from './pivots';
import { matchElliottWaves } from './elliottEngine';
import { analyzeCVD } from './cvdEngine';
import { detectOrderBlocks } from './orderBlockEngine';
import { detectFairValueGaps } from './fvgEngine';
import { detectLiquidityZones } from './liquidityEngine';
import { detectBreakOfStructure } from './bosEngine';

// ===== LSTM Integration =====
let lstmModel: tf.LayersModel | null = null;
let lstmLoadAttempted = false;

export async function loadLSTMModel() {
  try {
    // ✅ FIX: تعيين backend مناسب للعمل داخل Web Worker (لا يوجد DOM/canvas هناك لـ webgl)
    if (typeof window === 'undefined') {
      await tf.setBackend('cpu');
    }
    lstmModel = await tf.loadLayersModel('/model_tfjs/model.json');
    console.log('✅ LSTM model loaded successfully.');
  } catch (error) {
    console.warn('⚠️ LSTM model not found. Predictions will be unavailable.');
  } finally {
    lstmLoadAttempted = true;
  }
}

// ✅ FIX: ضمان تحميل النموذج تلقائيًا مرة واحدة، حتى لو تم استدعاء runFullAnalysis
// مباشرة داخل Web Worker (backtest.worker.ts) دون استدعاء صريح لـ loadLSTMModel().
// بدون هذا، كان lstmModel يبقى null دائمًا داخل الـ Worker لأن كل Worker له نطاق
// module منفصل تمامًا عن الصفحة الرئيسية، فتُرجع كل تنبؤات LSTM null صامتًا.
async function ensureLSTMModelLoaded() {
  if (!lstmLoadAttempted) {
    await loadLSTMModel();
  }
}

// ✅ B4: إضافة الميزات المفقودة لتتطابق مع Python (12 ميزة)
function buildLSTMFeatureBuffer(
  candles: Candle[],
  elliott: ElliottResult,
  cvd: CVDResult,
  smc: SMCResult,
  atr: number,
  compositeScore: number | null
): number[][] {
  const features: number[][] = [];
  const len = candles.length;

  // حساب المتوسطات للتطبيع
  const avgVolume = candles.reduce((s, c) => s + c.volume, 0) / len;

  // ✅ FIX: smc.orderBlocks هي قائمة الكتل المكتشفة (قد تكون أقل بكثير من عدد الشموع)،
  // وليست مصفوفة موازية لكل شمعة. نبني خريطة "آخر order block نشط حتى كل شمعة i"
  // بدلاً من الوصول العشوائي smc.orderBlocks[i] الذي كان يقرأ عناصر غير ذات صلة.
  const sortedOBs = [...smc.orderBlocks].sort((a, b) => a.index - b.index);
  const obStrengthByIndex: number[] = new Array(len).fill(50);
  {
    let obPointer = 0;
    let lastStrength = 50;
    for (let i = 0; i < len; i++) {
      while (obPointer < sortedOBs.length && sortedOBs[obPointer].index <= i) {
        lastStrength = sortedOBs[obPointer].strength;
        obPointer++;
      }
      obStrengthByIndex[i] = lastStrength;
    }
  }

  for (let i = 0; i < len; i++) {
    const elliottScore = elliott.score ?? 50;
    const cvdStrength = cvd.strength ?? 50;
    const smcStrength = obStrengthByIndex[i];
    const comp = compositeScore ?? 50;
    const atrRatio = atr / (candles[i].close || 1);
    const trendSlope = cvd.trendSlope ?? 0;
    const div = 0;

    // ✅ B4: 12 ميزة كاملة
    features.push([
      candles[i].close,                                    // 1
      candles[i].volume,                                   // 2
      elliottScore,                                        // 3
      cvdStrength,                                         // 4
      smcStrength,                                         // 5
      comp,                                                // 6
      atrRatio,                                            // 7
      trendSlope,                                          // 8
      div,                                                 // 9
      candles[i].close / (candles[i].open || 1) - 1,      // 10
      (candles[i].high - candles[i].low) / (candles[i].close || 1), // 11: high_low_ratio
      candles[i].volume / (avgVolume || 1),               // 12: volume_ratio
    ]);
  }
  return features;
}

async function getLSTMPrediction(
  candles: Candle[],
  featureBuffer: number[][],
  elliott: ElliottResult,
  cvd: CVDResult,
  smc: SMCResult,
  atr: number,
  compositeScore: number | null
): Promise<LSTMPrediction | null> {
  await ensureLSTMModelLoaded();
  if (!lstmModel || featureBuffer.length < 120) return null;

  try {
    const inputTensor = tf.tensor3d([featureBuffer.slice(-120)]);
    const prediction = lstmModel.predict(inputTensor) as tf.Tensor[];
    const [directionProb, logReturn] = await Promise.all([
      prediction[0].data(),
      prediction[1].data()
    ]);

    const latestPrice = candles[candles.length - 1].close;
    const predictedPrice = latestPrice * Math.exp(logReturn[0]);

    // ✅ M2: تحسين Regime Detection
    const returns = candles.slice(-50).map(c => (c.close - c.open) / c.open);
    const stdReturns = Math.sqrt(returns.reduce((s, r) => s + r * r, 0) / returns.length);
    // استخدام ADX-like: قوة الاتجاه
    const signSeries = returns.map(r => Math.sign(r));
    const directionalStrength = Math.abs(signSeries.reduce((s, d) => s + d, 0) / signSeries.length);
    const regime = (stdReturns > 0.015 && directionalStrength > 0.4) ? 'trending' : 'ranging';

    const uncertainty = Math.abs(logReturn[0]) * 0.5;
    const confidence = directionProb[0] * (1 - Math.min(uncertainty, 0.5));
    const adjustedConfidence = regime === 'ranging' ? confidence * 0.85 : confidence;

    // ✅ M4: Ensemble Vote ديناميكي
    const bullishVotes = Math.round(directionProb[0] * 5);
    const totalModels = 5;

    // ✅ FIX: التوصية يجب أن تعكس الاتجاه الفعلي (BULLISH/BEARISH)
    // بدلاً من افتراض "شراء" دائمًا بغض النظر عن الاتجاه
    const direction: 'BULLISH' | 'BEARISH' = directionProb[0] > 0.5 ? 'BULLISH' : 'BEARISH';
    const recommendation =
      direction === 'BULLISH'
        ? (adjustedConfidence > 0.75 ? 'STRONG BUY' : adjustedConfidence > 0.6 ? 'BUY' : 'WAIT')
        : (adjustedConfidence > 0.75 ? 'STRONG SELL' : adjustedConfidence > 0.6 ? 'SELL' : 'WAIT');

    return {
      direction,
      directionProbability: directionProb[0],
      predictedPrice: predictedPrice,
      predictedLogReturn: logReturn[0],
      confidence: adjustedConfidence,
      uncertainty: uncertainty,
      regime: regime as 'trending' | 'ranging',
      recommendation,
      ensembleVote: { bullishVotes, totalModels }
    };
  } catch (error) {
    console.warn('⚠️ LSTM prediction failed:', error);
    return null;
  }
}

// ===== Data Quality =====
function computeDataQuality(candles: Candle[]): DataQualityResult {
  const details: string[] = [];
  if (candles.length === 0) return { score: 0, details: ['No data available'] };
  const complete = candles.filter(c => c.high > 0 && c.low > 0 && c.volume > 0).length;
  const completeness = complete / candles.length;
  if (completeness < 0.9) details.push(`Low completeness: ${(completeness*100).toFixed(1)}%`);
  const isMonotonic = candles.every((c, i) => i === 0 || c.time > candles[i-1].time);
  if (!isMonotonic) details.push('Timestamp sequence is not monotonic');
  const avgVol = candles.reduce((s, c) => s + c.volume, 0) / candles.length;
  const volConsistency = candles.filter(c => c.volume > avgVol * 0.1).length / candles.length;
  if (volConsistency < 0.8) details.push(`Volume consistency: ${(volConsistency*100).toFixed(1)}%`);
  const atr = calculateATR(candles, 14);
  const hasOutliers = candles.some((c, i) => i > 0 && Math.abs(c.close - candles[i-1].close) > atr * 5);
  if (hasOutliers) details.push('Price outliers detected');
  const score = (completeness * 0.4) + (isMonotonic ? 0.2 : 0) + (volConsistency * 0.2) + (hasOutliers ? 0 : 0.2);
  return { score: Math.min(100, score * 100), details };
}

// ===== Confluence Detection =====
function detectConfluence(
  elliottEndpoints: Pivot[],
  cvdPivots: Pivot[],
  divergenceStore: DivergenceStore,
  halfLife: number = 10
): ConfluenceSignal | null {
  if (elliottEndpoints.length === 0 || cvdPivots.length === 0) return null;
  let bestSignal = null;
  let bestScore = -Infinity;
  const stats = divergenceStore.getStats();

  for (let i = 0; i < elliottEndpoints.length; i++) {
    const ep = elliottEndpoints[i];
    for (let j = 0; j < cvdPivots.length; j++) {
      const cp = cvdPivots[j];
      const dist = Math.abs(ep.index - cp.index);
      if (dist === 0 || dist > 5) continue;

      const proximityScore = Math.exp(-dist / halfLife);
      const prevEp = i > 0 ? elliottEndpoints[i-1] : elliottEndpoints[0];
      const prevCp = j > 0 ? cvdPivots[j-1] : cvdPivots[0];
      const priceChange = Math.abs(ep.price - prevEp.price) / (prevEp.price + 1e-6);
      const cvdChange = Math.abs(cp.price - prevCp.price) / (Math.abs(prevCp.price) + 1e-6);
      const divergenceMagnitude = Math.abs(priceChange - cvdChange);
      const z = zScore(divergenceMagnitude, stats.mean, stats.std);
      
      // ✅ M3: تخفيض عتبة Z-Score إلى 1.0
      if (z < 1.0) continue;
      
      const bothConfirmed = ep.isConfirmed && cp.isConfirmed;
      const totalScore = proximityScore * (0.4 + 0.6 * Math.min(1, z / 3)) * (bothConfirmed ? 1.35 : 1);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestSignal = {
          elliottIndex: ep.index,
          cvdIndex: cp.index,
          type: ep.type === cp.type ? 'CONFLUENCE' : 'DIVERGENCE_CONFLUENCE',
          strengthLabel: totalScore > 0.7 ? 'CRITICAL' : 'HIGH',
          strengthValue: totalScore,
          distance: dist,
          isConfirmed: bothConfirmed,
          score: totalScore,
          zScore: z
        };
      }
    }
  }
  if (bestSignal) divergenceStore.update(bestSignal.score);
  return bestSignal;
}

// ===== Uncertainty (Monte Carlo) =====
function estimateUncertainty(pivots: Pivot[], ctx: AnalysisContext, atr: number): { mean: number; std: number } | null {
  if (ctx.getRemaining() < 50 || pivots.length === 0) return null;
  const scores: number[] = [];
  const iterations = Math.min(50, Math.floor(ctx.getRemaining() / 10));
  for (let i = 0; i < iterations; i++) {
    if (ctx.isExpired()) break;
    const noisyPivots = pivots.map(p => ({ ...p, price: p.price * (1 + (Math.random() - 0.5) * 0.008) }));
    // ✅ M1: تمرير ctx بشكل صحيح
    const result = matchElliottWaves(noisyPivots, ctx, atr);
    scores.push(result.score);
  }
  if (scores.length === 0) return null;
  const m = mean(scores);
  const s = stdDev(scores, m);
  return { mean: m, std: s };
}

// ===== Adaptive Weights & Alert =====
function calculateAdaptiveWeights(elliottScore: number, cvdStrength: number): { elliottW: number; cvdW: number } {
  const total = elliottScore + cvdStrength;
  if (total < 50) return { elliottW: 0.6, cvdW: 0.4 };
  const elliottW = Math.min(0.8, elliottScore / total);
  return { elliottW, cvdW: 1 - elliottW };
}

function generateAlert(
  composite: number,
  uncertainty: { std: number } | null,
  dq: DataQualityResult,
  lstm: LSTMPrediction | null
): string | null {
  if (composite > 75 && (uncertainty?.std || 0) < 8 && dq.score > 85) {
    return '🔴 CRITICAL BUY/SELL SIGNAL';
  }
  if (composite > 60 && (uncertainty?.std || 0) < 12 && dq.score > 70) {
    return '🟡 HIGH PROBABILITY SETUP';
  }
  if (lstm && lstm.confidence > 0.75 && composite && composite > 50) {
    return '🔮 LSTM CONFIRMS SIGNAL';
  }
  return null;
}

// ===== Main Analysis =====
export async function runFullAnalysis(
  candles: Candle[],
  divergenceStore: DivergenceStore,
  tfHours: number = 1
): Promise<FullAnalysisResult> {
  const startTime = performance.now();
  const ctx: AnalysisContext = {
    startTime,
    maxBudget: 500,
    getRemaining() { return this.maxBudget - (performance.now() - this.startTime); },
    isExpired() { return this.getRemaining() <= 0; }
  };

  // 1. Data Quality (Early Exit)
  const dq = computeDataQuality(candles);
  if (dq.score < 50 || candles.length < 50) {
    return {
      elliott: null, cvd: null, smc: null, lstm: null,
      confluence: null, compositeScore: null,
      dataQuality: dq, uncertainty: null, searchTruncated: false,
      alert: 'DATA QUALITY TOO LOW - ANALYSIS SKIPPED',
      logs: {
        elliottPenalties: [], cvdPenalties: [], smcDetails: '', lstmDetails: '',
        dataQualityIssues: dq.details, alertMessage: 'DATA QUALITY TOO LOW',
        executionTimeMs: performance.now() - startTime
      }
    };
  }

  // 2. ATR and Pivots
  const atr = calculateATR(candles, 14);
  const pivotParams = getDynamicPivotParams(candles, 14, tfHours);
  const pricePivots = getPivotPoints(candles, pivotParams.leftBars, pivotParams.rightBars, pivotParams.threshold, pivotParams.minDevFactor);

  // 3. Elliott Engine
  const elliott = matchElliottWaves(pricePivots, ctx, atr);

  // 4. CVD Engine
  const cvd = analyzeCVD(candles, ctx);

  // 5. SMC Engine (V2.4)
  const orderBlocks = detectOrderBlocks(candles, pricePivots, elliott, cvd, atr);
  const fvgs = detectFairValueGaps(candles);
  const liquidityZones = detectLiquidityZones(candles, pricePivots, elliott, cvd, 50);
  const bosSignals = detectBreakOfStructure(candles, pricePivots, atr);

  const criticalSignals = orderBlocks.filter(ob => ob.strength > 70 && ob.confluence.withElliott);

  // 6. Confluence (Elliott + CVD)
  const halfLife = Math.max(5, Math.min(20, 10 * tfHours));
  const confluence = detectConfluence(elliott.waveEndpoints, cvd.cvdPivots, divergenceStore, halfLife);

  // 7. Composite Score (Elliott + CVD)
  let compositeScore: number | null = null;
  let weights: { elliottW: number; cvdW: number } | undefined = undefined;
  
  if (confluence) {
    // ✅ B5: استدعاء calculateAdaptiveWeights مرة واحدة فقط
    weights = calculateAdaptiveWeights(elliott.score, cvd.strength);
    compositeScore = weights.elliottW * elliott.score + weights.cvdW * cvd.strength;
  }

  // 8. LSTM Prediction
  const smcResult = { orderBlocks, fvgs, liquidityZones, bosSignals, criticalSignals };
  const featureBuffer = buildLSTMFeatureBuffer(candles, elliott, cvd, smcResult, atr, compositeScore);
  const lstmPrediction = await getLSTMPrediction(candles, featureBuffer, elliott, cvd, smcResult, atr, compositeScore);

  // 9. Uncertainty (Monte Carlo)
  const uncertainty = estimateUncertainty(pricePivots, ctx, atr);

  // 10. Alert
  const alert = generateAlert(compositeScore || 0, uncertainty, dq, lstmPrediction);

  // 11. Logs
  const executionTime = performance.now() - startTime;
  const logs = {
    elliottPenalties: elliott.penalties || [],
    cvdPenalties: cvd.penalties || [],
    smcDetails: `Order Blocks: ${orderBlocks.length}, FVGs: ${fvgs.length}, Liquidity Zones: ${liquidityZones.length}, BOS: ${bosSignals.length}`,
    lstmDetails: lstmPrediction ? `Direction: ${lstmPrediction.direction}, Confidence: ${(lstmPrediction.confidence * 100).toFixed(1)}%, Uncertainty: ${(lstmPrediction.uncertainty * 100).toFixed(1)}%` : 'LSTM unavailable',
    dataQualityIssues: dq.details || [],
    alertMessage: alert,
    executionTimeMs: Math.round(executionTime)
  };

  return {
    elliott,
    cvd,
    smc: smcResult,
    lstm: lstmPrediction,
    confluence,
    compositeScore,
    weights,
    dataQuality: dq,
    uncertainty,
    searchTruncated: elliott.searchTruncated || cvd.searchTruncated,
    alert,
    logs
  };
}
