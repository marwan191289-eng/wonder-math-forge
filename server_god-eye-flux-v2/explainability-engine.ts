/**
 * Signal Explainability Engine
 * Generates human-readable reasoning for all analytical signals
 * Full Arabic/English bilingual support
 */

import type { CompositeScore, ScoreComponents } from './scoring-engine';
import type { WallAnalysis, Wall } from './whale-detection';
import type { SMCAnalysis } from './smc-detection';

export interface SignalExplanation {
  en: string;
  ar: string;
}

export interface ComponentBreakdown {
  name: string;
  nameAr: string;
  value: number;
  contribution: number;
  explanation: SignalExplanation;
}

export interface FullSignalExplanation {
  scoreExplanation: SignalExplanation;
  confidenceExplanation: SignalExplanation;
  regimeExplanation: SignalExplanation;
  componentBreakdowns: ComponentBreakdown[];
  wallsExplanation: SignalExplanation;
  smcExplanation: SignalExplanation;
  overallReasoning: SignalExplanation;
}

/**
 * Generate explanation for composite score
 */
export function explainCompositeScore(score: CompositeScore): FullSignalExplanation {
  const componentBreakdowns = explainComponents(score.components);
  
  return {
    scoreExplanation: explainScoreValue(score.score),
    confidenceExplanation: explainConfidence(score.confidence),
    regimeExplanation: explainRegime(score.regime),
    componentBreakdowns,
    wallsExplanation: { en: '', ar: '' },
    smcExplanation: { en: '', ar: '' },
    overallReasoning: generateOverallReasoning(score, componentBreakdowns),
  };
}

/**
 * Explain score value
 */
function explainScoreValue(score: number): SignalExplanation {
  let en = '';
  let ar = '';

  if (score > 70) {
    en = `Extremely bullish signal (${score.toFixed(0)}). Strong institutional buying pressure detected across all metrics.`;
    ar = `إشارة صعودية قوية جداً (${score.toFixed(0)}). تم اكتشاف ضغط شراء مؤسسي قوي عبر جميع المقاييس.`;
  } else if (score > 50) {
    en = `Strong bullish signal (${score.toFixed(0)}). Multiple bullish indicators aligned with positive momentum.`;
    ar = `إشارة صعودية قوية (${score.toFixed(0)}). عدة مؤشرات صعودية متوافقة مع زخم إيجابي.`;
  } else if (score > 30) {
    en = `Moderate bullish bias (${score.toFixed(0)}). Mixed signals with slight bullish lean.`;
    ar = `انحياز صعودي معتدل (${score.toFixed(0)}). إشارات مختلطة مع ميل صعودي طفيف.`;
  } else if (score > 0) {
    en = `Slight bullish lean (${score.toFixed(0)}). Neutral market with minor bullish pressure.`;
    ar = `ميل صعودي طفيف (${score.toFixed(0)}). سوق محايد مع ضغط صعودي طفيف.`;
  } else if (score > -30) {
    en = `Slight bearish lean (${score.toFixed(0)}). Neutral market with minor bearish pressure.`;
    ar = `ميل هبوطي طفيف (${score.toFixed(0)}). سوق محايد مع ضغط هبوطي طفيف.`;
  } else if (score > -50) {
    en = `Moderate bearish bias (${score.toFixed(0)}). Mixed signals with slight bearish lean.`;
    ar = `انحياز هبوطي معتدل (${score.toFixed(0)}). إشارات مختلطة مع ميل هبوطي طفيف.`;
  } else if (score > -70) {
    en = `Strong bearish signal (${score.toFixed(0)}). Multiple bearish indicators aligned with negative momentum.`;
    ar = `إشارة هبوطية قوية (${score.toFixed(0)}). عدة مؤشرات هبوطية متوافقة مع زخم سلبي.`;
  } else {
    en = `Extremely bearish signal (${score.toFixed(0)}). Strong institutional selling pressure detected across all metrics.`;
    ar = `إشارة هبوطية قوية جداً (${score.toFixed(0)}). تم اكتشاف ضغط بيع مؤسسي قوي عبر جميع المقاييس.`;
  }

  return { en, ar };
}

/**
 * Explain confidence level
 */
function explainConfidence(confidence: number): SignalExplanation {
  let en = '';
  let ar = '';

  if (confidence >= 90) {
    en = `Very high confidence (${confidence.toFixed(0)}%). All analytical components are in strong agreement.`;
    ar = `ثقة عالية جداً (${confidence.toFixed(0)}%). جميع المكونات التحليلية متفقة بقوة.`;
  } else if (confidence >= 75) {
    en = `High confidence (${confidence.toFixed(0)}%). Most components align with the signal direction.`;
    ar = `ثقة عالية (${confidence.toFixed(0)}%). معظم المكونات متوافقة مع اتجاه الإشارة.`;
  } else if (confidence >= 60) {
    en = `Moderate confidence (${confidence.toFixed(0)}%). Components show reasonable agreement with some divergence.`;
    ar = `ثقة معتدلة (${confidence.toFixed(0)}%). المكونات تظهر توافقاً معقولاً مع بعض الاختلاف.`;
  } else if (confidence >= 40) {
    en = `Low confidence (${confidence.toFixed(0)}%). Significant component divergence detected. Signal may be unreliable.`;
    ar = `ثقة منخفضة (${confidence.toFixed(0)}%). تم اكتشاف اختلاف كبير في المكونات. قد تكون الإشارة غير موثوقة.`;
  } else {
    en = `Very low confidence (${confidence.toFixed(0)}%). Components are highly divergent. Do not rely on this signal.`;
    ar = `ثقة منخفضة جداً (${confidence.toFixed(0)}%). المكونات متباعدة جداً. لا تعتمد على هذه الإشارة.`;
  }

  return { en, ar };
}

/**
 * Explain market regime
 */
function explainRegime(regime: 'trending' | 'ranging' | 'volatile'): SignalExplanation {
  const explanations = {
    trending: {
      en: 'Market is in a clear trend. Price is making higher highs/lows or lower highs/lows. Momentum-based strategies work best.',
      ar: 'السوق في اتجاه واضح. السعر يحقق قمم/قيعان أعلى أو قمم/قيعان أقل. استراتيجيات الزخم تعمل بشكل أفضل.',
    },
    ranging: {
      en: 'Market is ranging between support/resistance levels. Price oscillates without clear direction. Mean-reversion strategies may work.',
      ar: 'السوق يتحرك بين مستويات الدعم/المقاومة. السعر يتذبذب بدون اتجاه واضح. قد تعمل استراتيجيات العودة للمتوسط.',
    },
    volatile: {
      en: 'Market is highly volatile with large price swings. Risk is elevated. Use wider stops and smaller positions.',
      ar: 'السوق متقلب جداً مع تحركات أسعار كبيرة. المخاطرة مرتفعة. استخدم محطات أوسع ومراكز أصغر.',
    },
  };

  return explanations[regime];
}

/**
 * Explain individual components
 */
function explainComponents(components: ScoreComponents): ComponentBreakdown[] {
  const total = Math.abs(components.bookImbalance) +
                Math.abs(components.wallPressure) +
                Math.abs(components.momentum) +
                Math.abs(components.microDrift) +
                Math.abs(components.rsi) +
                Math.abs(components.cvdSignal) +
                Math.abs(components.ofiSignal);

  return [
    {
      name: 'Book Imbalance',
      nameAr: 'عدم توازن دفتر الطلبات',
      value: components.bookImbalance,
      contribution: (Math.abs(components.bookImbalance) / total) * 100,
      explanation: explainBookImbalance(components.bookImbalance),
    },
    {
      name: 'Wall Pressure',
      nameAr: 'ضغط الجدران',
      value: components.wallPressure,
      contribution: (Math.abs(components.wallPressure) / total) * 100,
      explanation: explainWallPressure(components.wallPressure),
    },
    {
      name: 'Momentum',
      nameAr: 'الزخم',
      value: components.momentum,
      contribution: (Math.abs(components.momentum) / total) * 100,
      explanation: explainMomentum(components.momentum),
    },
    {
      name: 'Micro-Drift',
      nameAr: 'الانجراف الدقيق',
      value: components.microDrift,
      contribution: (Math.abs(components.microDrift) / total) * 100,
      explanation: explainMicroDrift(components.microDrift),
    },
    {
      name: 'RSI',
      nameAr: 'مؤشر القوة النسبية',
      value: components.rsi,
      contribution: (Math.abs(components.rsi) / total) * 100,
      explanation: explainRSI(components.rsi),
    },
    {
      name: 'CVD Signal',
      nameAr: 'إشارة CVD',
      value: components.cvdSignal,
      contribution: (Math.abs(components.cvdSignal) / total) * 100,
      explanation: explainCVD(components.cvdSignal),
    },
    {
      name: 'OFI Signal',
      nameAr: 'إشارة OFI',
      value: components.ofiSignal,
      contribution: (Math.abs(components.ofiSignal) / total) * 100,
      explanation: explainOFI(components.ofiSignal),
    },
  ];
}

function explainBookImbalance(value: number): SignalExplanation {
  if (value > 0.5) {
    return {
      en: 'Strong buy pressure in order book. Bid side significantly larger than ask side.',
      ar: 'ضغط شراء قوي في دفتر الطلبات. جانب الطلب أكبر بكثير من جانب العرض.',
    };
  } else if (value > 0.2) {
    return {
      en: 'Moderate buy pressure. More bids than asks at top levels.',
      ar: 'ضغط شراء معتدل. طلبات أكثر من العروض على المستويات العليا.',
    };
  } else if (value < -0.5) {
    return {
      en: 'Strong sell pressure in order book. Ask side significantly larger than bid side.',
      ar: 'ضغط بيع قوي في دفتر الطلبات. جانب العرض أكبر بكثير من جانب الطلب.',
    };
  } else if (value < -0.2) {
    return {
      en: 'Moderate sell pressure. More asks than bids at top levels.',
      ar: 'ضغط بيع معتدل. عروض أكثر من الطلبات على المستويات العليا.',
    };
  } else {
    return {
      en: 'Balanced order book. Buy and sell pressure are approximately equal.',
      ar: 'دفتر طلبات متوازن. ضغط الشراء والبيع متساويان تقريباً.',
    };
  }
}

function explainWallPressure(value: number): SignalExplanation {
  if (value > 0.5) {
    return {
      en: 'Significant bid walls detected. Large buy orders supporting price.',
      ar: 'تم اكتشاف جدران طلب كبيرة. طلبات شراء كبيرة تدعم السعر.',
    };
  } else if (value < -0.5) {
    return {
      en: 'Significant ask walls detected. Large sell orders resisting price.',
      ar: 'تم اكتشاف جدران عرض كبيرة. طلبات بيع كبيرة تقاوم السعر.',
    };
  } else {
    return {
      en: 'Balanced wall structure. No significant whale activity detected.',
      ar: 'هيكل جدران متوازن. لم يتم اكتشاف نشاط حيتان كبير.',
    };
  }
}

function explainMomentum(value: number): SignalExplanation {
  if (value > 0.5) {
    return {
      en: 'Strong upward momentum. Price and volume accelerating higher.',
      ar: 'زخم صعودي قوي. السعر والحجم يتسارعان للأعلى.',
    };
  } else if (value < -0.5) {
    return {
      en: 'Strong downward momentum. Price and volume accelerating lower.',
      ar: 'زخم هبوطي قوي. السعر والحجم يتسارعان للأسفل.',
    };
  } else {
    return {
      en: 'Neutral momentum. Price action lacks clear directional strength.',
      ar: 'زخم محايد. حركة السعر تفتقر إلى قوة اتجاهية واضحة.',
    };
  }
}

function explainMicroDrift(value: number): SignalExplanation {
  if (value > 0.5) {
    return {
      en: 'Strong short-term uptrend. Most recent candles closing higher.',
      ar: 'اتجاه صعودي قصير الأجل قوي. معظم الشموع الأخيرة تغلق أعلى.',
    };
  } else if (value < -0.5) {
    return {
      en: 'Strong short-term downtrend. Most recent candles closing lower.',
      ar: 'اتجاه هبوطي قصير الأجل قوي. معظم الشموع الأخيرة تغلق أقل.',
    };
  } else {
    return {
      en: 'Mixed short-term direction. No clear micro-trend established.',
      ar: 'اتجاه قصير الأجل مختلط. لا يوجد اتجاه دقيق واضح.',
    };
  }
}

function explainRSI(value: number): SignalExplanation {
  if (value > 0.3) {
    return {
      en: 'RSI in overbought territory. Potential pullback or consolidation.',
      ar: 'مؤشر القوة النسبية في منطقة الإفراط في الشراء. احتمال حدوث تراجع أو توحيد.',
    };
  } else if (value < -0.3) {
    return {
      en: 'RSI in oversold territory. Potential bounce or reversal.',
      ar: 'مؤشر القوة النسبية في منطقة الإفراط في البيع. احتمال حدوث ارتداد أو انعكاس.',
    };
  } else {
    return {
      en: 'RSI in neutral zone. No extreme condition detected.',
      ar: 'مؤشر القوة النسبية في المنطقة المحايدة. لم يتم اكتشاف حالة متطرفة.',
    };
  }
}

function explainCVD(value: number): SignalExplanation {
  if (value > 0.5) {
    return {
      en: 'Strong cumulative buying volume. Institutional accumulation detected.',
      ar: 'حجم شراء تراكمي قوي. تم اكتشاف تراكم مؤسسي.',
    };
  } else if (value < -0.5) {
    return {
      en: 'Strong cumulative selling volume. Institutional distribution detected.',
      ar: 'حجم بيع تراكمي قوي. تم اكتشاف توزيع مؤسسي.',
    };
  } else {
    return {
      en: 'Balanced cumulative volume. No clear accumulation or distribution.',
      ar: 'حجم تراكمي متوازن. لا يوجد تراكم أو توزيع واضح.',
    };
  }
}

function explainOFI(value: number): SignalExplanation {
  if (value > 0.5) {
    return {
      en: 'Strong order flow imbalance favoring buyers. Aggressive buying detected.',
      ar: 'عدم توازن تدفق الطلبات لصالح المشترين. تم اكتشاف شراء عدواني.',
    };
  } else if (value < -0.5) {
    return {
      en: 'Strong order flow imbalance favoring sellers. Aggressive selling detected.',
      ar: 'عدم توازن تدفق الطلبات لصالح البائعين. تم اكتشاف بيع عدواني.',
    };
  } else {
    return {
      en: 'Balanced order flow. No clear directional bias in orders.',
      ar: 'تدفق طلبات متوازن. لا يوجد انحياز اتجاهي واضح في الطلبات.',
    };
  }
}

/**
 * Generate overall reasoning
 */
function generateOverallReasoning(score: CompositeScore, components: ComponentBreakdown[]): SignalExplanation {
  const topComponent = components.sort((a, b) => b.contribution - a.contribution)[0];
  
  let en = `${score.reasoning} The strongest signal comes from ${topComponent.name} (${topComponent.contribution.toFixed(0)}% contribution).`;
  let ar = `${score.reasoning} أقوى إشارة تأتي من ${topComponent.nameAr} (${topComponent.contribution.toFixed(0)}% مساهمة).`;

  if (score.side === 'long') {
    en += ' This suggests a bullish opportunity with institutional buying pressure.';
    ar += ' يشير هذا إلى فرصة صعودية مع ضغط شراء مؤسسي.';
  } else if (score.side === 'short') {
    en += ' This suggests a bearish opportunity with institutional selling pressure.';
    ar += ' يشير هذا إلى فرصة هبوطية مع ضغط بيع مؤسسي.';
  } else {
    en += ' The market remains neutral with no clear directional bias.';
    ar += ' السوق يبقى محايداً بدون انحياز اتجاهي واضح.';
  }

  return { en, ar };
}

/**
 * Explain whale walls
 */
export function explainWalls(analysis: WallAnalysis): SignalExplanation {
  const bidWallCount = analysis.bidWalls.length;
  const askWallCount = analysis.askWalls.length;
  const totalWallUsd = analysis.totalBidWallUsd + analysis.totalAskWallUsd;

  let en = `Detected ${bidWallCount} bid walls and ${askWallCount} ask walls totaling $${(totalWallUsd / 1000000).toFixed(2)}M. `;
  let ar = `تم اكتشاف ${bidWallCount} جدران طلب و ${askWallCount} جدران عرض بإجمالي $${(totalWallUsd / 1000000).toFixed(2)}M. `;

  if (analysis.significance === 'critical') {
    en += 'CRITICAL wall activity detected. Major whale positioning likely.';
    ar += 'تم اكتشاف نشاط جدران حرج. من المحتمل حدوث تموضع حيتان كبير.';
  } else if (analysis.significance === 'high') {
    en += 'Significant wall activity. Institutional interest evident.';
    ar += 'نشاط جدران كبير. الاهتمام المؤسسي واضح.';
  } else if (analysis.significance === 'medium') {
    en += 'Moderate wall activity. Some whale positioning detected.';
    ar += 'نشاط جدران معتدل. تم اكتشاف بعض تموضع الحيتان.';
  } else {
    en += 'Low wall activity. Minimal whale positioning.';
    ar += 'نشاط جدران منخفض. تموضع حيتان ضئيل.';
  }

  return { en, ar };
}

/**
 * Explain SMC patterns
 */
export function explainSMC(analysis: SMCAnalysis): SignalExplanation {
  let en = `Market in ${analysis.trend} trend. `;
  let ar = `السوق في اتجاه ${analysis.trend === 'uptrend' ? 'صعودي' : analysis.trend === 'downtrend' ? 'هبوطي' : 'محايد'}. `;

  if (analysis.bosLevels.length > 0) {
    en += `${analysis.bosLevels.length} Break of Structure level(s) detected. `;
    ar += `تم اكتشاف ${analysis.bosLevels.length} مستوى(ات) كسر الهيكل. `;
  }

  if (analysis.chochLevels.length > 0) {
    en += `${analysis.chochLevels.length} Change of Character detected. `;
    ar += `تم اكتشاف ${analysis.chochLevels.length} تغيير في الشخصية. `;
  }

  if (analysis.fvgs.length > 0) {
    en += `${analysis.fvgs.length} Fair Value Gap(s) present. `;
    ar += `${analysis.fvgs.length} فجوة(ات) قيمة عادلة موجودة. `;
  }

  if (analysis.orderBlocks.length > 0) {
    en += `${analysis.orderBlocks.length} Order Block(s) identified as key support/resistance.`;
    ar += `تم تحديد ${analysis.orderBlocks.length} كتلة(كتل) طلب كمفتاح دعم/مقاومة.`;
  }

  return { en, ar };
}
