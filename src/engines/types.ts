// engine/types.ts

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume?: number;
}

export interface Pivot {
  index: number;
  price: number;
  type: 'HIGH' | 'LOW';
  isConfirmed: boolean;
  strength: number;
  direction?: 'UP' | 'DOWN';
}

export interface AnalysisContext {
  startTime: number;
  maxBudget: number;
  getRemaining(): number;
  isExpired(): boolean;
}

export interface DataQualityResult {
  score: number;
  details: string[];
}

// ===== Elliott =====
export interface Wave {
  start: Pivot;
  end: Pivot;
  length: number;
  duration: number;
}

export interface WaveSequence {
  waves: Wave[];
  score: number;
  penalties: string[];
  lastIndex: number;
}

export interface ElliottResult {
  bestCount: WaveSequence;
  alternates: WaveSequence[];
  score: number;
  waveEndpoints: Pivot[];
  searchTruncated: boolean;
  projections: Projection[];
  penalties: string[];
}

export interface Projection {
  formula: string;
  price: number;
  confidence: number;
}

// ===== CVD =====
export interface CVDResult {
  cvdPivots: Pivot[];
  strength: number;
  trendSlope: number;
  searchTruncated: boolean;
  penalties: string[];
}

// ===== SMC V2.4 =====
export interface OrderBlock {
  index: number;
  high: number;
  low: number;
  type: 'BULLISH' | 'BEARISH';
  strength: number;
  isConfirmed: boolean;
  isMitigated: boolean;
  mitigationPrice?: number;
  mitigationIndex?: number;
  isPartiallyMitigated: boolean;
  partialMitigationPrice?: number;
  partialMitigationIndex?: number;
  confluence: {
    withElliott: boolean;
    withCVD: boolean;
    elliottWaveNumber?: number;
    cvdDivergenceType?: 'BULLISH' | 'BEARISH';
  };
  bosIndex: number;
  bosStrength: number;
}

export interface FairValueGap {
  index: number;
  type: 'BULLISH_GAP' | 'BEARISH_GAP';
  top: number;
  bottom: number;
  size: number;
  isFilled: boolean;
  fillProbability: number;
  strength: number;
  filledIndex?: number;
  partialFill: boolean;
  partialFillIndex?: number;
}

export interface LiquidityZone {
  index: number;
  type: 'HIGH' | 'LOW';
  price: number;
  strength: number;
  isConfirmed: boolean;
  confluence: {
    withElliott: boolean;
    withCVD: boolean;
  };
  isBreached: boolean;
  breachPrice?: number;
  breachIndex?: number;
}

export interface BreakOfStructure {
  index: number;
  type: 'BULLISH_BOS' | 'BEARISH_BOS';
  breakLevel: number;
  previousStructure: number;
  strength: number;
  isConfirmed: boolean;
  volumeSpike: boolean;
}

export interface SMCResult {
  orderBlocks: OrderBlock[];
  fvgs: FairValueGap[];
  liquidityZones: LiquidityZone[];
  bosSignals: BreakOfStructure[];
  criticalSignals: OrderBlock[];
}

// ===== LSTM V2.1-Final =====
export interface LSTMPrediction {
  direction: 'BULLISH' | 'BEARISH';
  directionProbability: number;
  predictedPrice: number;
  predictedLogReturn: number;
  confidence: number;        // 0-1 (يُستخدم في كل مكان)
  uncertainty: number;
  regime: 'trending' | 'ranging';
  recommendation: 'STRONG BUY' | 'BUY' | 'SELL' | 'STRONG SELL' | 'WAIT';
  ensembleVote: {
    bullishVotes: number;
    totalModels: number;
  };
}

// ===== التكامل =====
export interface ConfluenceSignal {
  elliottIndex: number;
  cvdIndex: number;
  type: 'CONFLUENCE' | 'DIVERGENCE_CONFLUENCE';
  strengthLabel: 'CRITICAL' | 'HIGH';   // ✅ H2: للعرض فقط
  strengthValue: number;                // ✅ H2: قيمة رقمية للحسابات
  distance: number;
  isConfirmed: boolean;
  score: number;
  zScore: number;
}

export interface FullAnalysisResult {
  elliott: ElliottResult | null;
  cvd: CVDResult | null;
  smc: SMCResult | null;
  lstm: LSTMPrediction | null;
  confluence: ConfluenceSignal | null;
  compositeScore: number | null;
  weights?: { elliottW: number; cvdW: number };
  dataQuality: DataQualityResult;
  uncertainty: { mean: number; std: number } | null;
  searchTruncated: boolean;
  alert: string | null;
  logs: {
    elliottPenalties: string[];
    cvdPenalties: string[];
    smcDetails: string;
    lstmDetails: string;
    dataQualityIssues: string[];
    alertMessage: string | null;
    executionTimeMs: number;
  };
}

// ===== Divergence Store (Class-based) =====
export class DivergenceStore {
  private history: number[] = [];
  private readonly windowSize: number = 100;

  // ✅ H1: نقبل أي قيمة (بما فيها السالبة)
  update(value: number): void {
    if (isFinite(value)) {
      this.history.push(value);
      if (this.history.length > this.windowSize) {
        this.history.shift();
      }
    }
  }

  getStats(): { mean: number; std: number } {
    if (this.history.length === 0) {
      return { mean: 0, std: 0.25 };
    }
    const sum = this.history.reduce((a, b) => a + b, 0);
    const mean = sum / this.history.length;
    const variance = this.history.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / this.history.length;
    return { mean, std: Math.max(Math.sqrt(variance), 1e-6) };
  }
}