// src/engine/elliottEngine.ts

import { Pivot, Wave, WaveSequence, ElliottResult, Projection, AnalysisContext } from './types';
import { fibonacciScore, calculateATR } from '../utils/math';

function dynamicBeamWidth(pivotCount: number): number {
  return Math.max(4, Math.min(8, Math.round(pivotCount / 10)));
}

function calculateHeuristic(seq: WaveSequence, pivots: Pivot[], candidateIndex: number, atr: number): number {
  const lastWave = seq.waves[seq.waves.length - 1];
  const candidate = pivots[candidateIndex];
  if (!lastWave || !candidate) return 0;

  const waveNum = seq.waves.length + 1;
  const ratio = Math.abs(candidate.price - lastWave.end.price) / (lastWave.length || 1);
  const fibScore = waveNum % 2 === 1
    ? fibonacciScore(ratio, 1.618, 0.2)
    : fibonacciScore(ratio, 0.618, 0.2);

  let ruleScore = 50;
  if (waveNum === 2 && ratio > 0.854) ruleScore -= 30;
  if (waveNum === 4 && ratio < 0.146) ruleScore -= 20;

  const avgDuration = seq.waves.reduce((s, w) => s + w.duration, 0) / (seq.waves.length || 1);
  const timeRatio = (candidate.index - lastWave.end.index) / (avgDuration || 1);
  const timeScore = fibonacciScore(timeRatio, 1.0, 0.5);

  return fibScore * 0.5 + ruleScore * 0.3 + timeScore * 0.2;
}

function diversityPenalty(seq: WaveSequence, beam: WaveSequence[]): number {
  if (beam.length === 0) return 0;
  const similarities = beam.map(s => {
    const common = s.waves.filter(w => seq.waves.includes(w)).length;
    const total = Math.max(s.waves.length, seq.waves.length);
    return total > 0 ? common / total : 0;
  });
  const maxSim = Math.max(...similarities);
  return -maxSim * 0.1;
}

function beamSearch(pivots: Pivot[], ctx: AnalysisContext, atr: number, beamWidth: number): WaveSequence[] {
  let beam: WaveSequence[] = [{ waves: [], score: 0, penalties: [], lastIndex: -1 }];
  const maxDepth = Math.min(10, Math.floor(pivots.length / 2));

  for (let depth = 0; depth < maxDepth; depth++) {
    if (ctx.isExpired()) break;
    const candidates: WaveSequence[] = [];
    for (const seq of beam) {
      for (let i = seq.lastIndex + 1; i < pivots.length - 1; i++) {
        const candidate = pivots[i];
        const prevEnd = seq.waves.length > 0 ? seq.waves[seq.waves.length - 1].end : pivots[0];
        if (!prevEnd || !candidate) continue;

        const newWave: Wave = {
          start: prevEnd,
          end: candidate,
          length: Math.abs(candidate.price - prevEnd.price),
          duration: candidate.index - prevEnd.index
        };
        const newSeq = { ...seq, waves: [...seq.waves, newWave] };
        const heuristic = calculateHeuristic(newSeq, pivots, i, atr);
        const divPenalty = diversityPenalty(newSeq, beam);
        const totalScore = heuristic + divPenalty * 10;
        candidates.push({
          waves: [...seq.waves, newWave],
          score: totalScore,
          penalties: [],
          lastIndex: i
        });
      }
    }
    if (candidates.length === 0) break;
    beam = candidates.sort((a, b) => b.score - a.score).slice(0, beamWidth);
  }
  return beam;
}

function validateWaveSequence(seq: WaveSequence, atr: number): { score: number; penalties: string[] } {
  let score = seq.score;
  const penalties: string[] = [];
  const waves = seq.waves;
  if (waves.length < 5) {
    penalties.push('Incomplete wave count (less than 5 waves)');
    return { score: score * 0.3, penalties };
  }

  const [w1, w2, w3, w4, w5] = waves.slice(0, 5);

  const w1MinPrice = Math.min(w1.start.price, w1.end.price);
  if (w4.end.price > w1MinPrice) {
    penalties.push('CRITICAL: Wave 4 overlaps Wave 1 territory');
    score *= 0.4;
  }

  const w2Complex = Math.abs(w2.end.price - w2.start.price) > atr * 2;
  const w4Complex = Math.abs(w4.end.price - w4.start.price) > atr * 2;
  if (w2Complex === w4Complex) {
    penalties.push('Alternation rule violation');
    score *= 0.9;
  }

  const minLength = atr * 0.5;
  if (w1.length < minLength || w3.length < minLength || w5.length < minLength) {
    penalties.push('One or more impulse waves too short');
    score *= 0.7;
  }

  return { score: Math.min(100, Math.max(0, score)), penalties };
}

function calculateProjections(waves: Wave[]): Projection[] {
  if (waves.length < 5) return [];
  const [w1, w2, w3, w4, w5] = waves;
  const projections: Projection[] = [];
  const w3Ratio = w3.length / (w1.length || 1);
  if (w3Ratio > 1.618) {
    projections.push({
      formula: 'Wave 3 Extension (0.618 of Wave 3)',
      price: w4.end.price + (w3.length * 0.618),
      confidence: 0.8
    });
  } else {
    projections.push({
      formula: 'Classic Wave 1 Extension (1.618 of Wave 1)',
      price: w4.end.price + (w1.length * 1.618),
      confidence: 0.7
    });
  }
  return projections;
}

export function matchElliottWaves(pricePivots: Pivot[], ctx: AnalysisContext, atr: number): ElliottResult {
  const beamWidth = dynamicBeamWidth(pricePivots.length);
  const sequences = beamSearch(pricePivots, ctx, atr, beamWidth);
  const validated = sequences.map(seq => {
    const result = validateWaveSequence(seq, atr);
    return { ...seq, score: result.score, penalties: result.penalties };
  }).filter(s => s.waves.length >= 5);

  const sorted = validated.sort((a, b) => b.score - a.score);
  const best = sorted[0] || { waves: [], score: 0, penalties: ['No valid wave count found'], lastIndex: -1 };
  const alternates = sorted.slice(1, 5);

  return {
    bestCount: best,
    alternates,
    score: best.score,
    waveEndpoints: best.waves.map(w => w.end),
    searchTruncated: ctx.isExpired(),
    projections: calculateProjections(best.waves),
    penalties: best.penalties
  };
}
