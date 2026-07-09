/**
 * Backtesting Engine
 * Generates synthetic order books from kline data and replays historical signals
 * IMPORTANT: All backtesting data is SYNTHETIC and clearly labeled as such
 */

export interface Kline {
  symbol: string;
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
}

export interface SyntheticOrderBook {
  symbol: string;
  timestamp: number;
  price: number;
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
  isSynthetic: true;
  label: 'SYNTHETIC BOOK SIMULATION';
}

export interface BacktestResult {
  symbol: string;
  startTime: number;
  endTime: number;
  startPrice: number;
  endPrice: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  isSynthetic: true;
  label: 'SYNTHETIC BACKTEST RESULTS';
}

/**
 * Generate synthetic order book from kline data
 * Uses volume distribution and price levels to create realistic-looking order books
 */
export function generateSyntheticOrderBook(
  kline: Kline,
  volatility: number = 0.02
): SyntheticOrderBook {
  const close = parseFloat(kline.close);
  const volume = parseFloat(kline.quoteAssetVolume);

  // Generate bid/ask levels based on volatility
  const bidLevels = generateLevels(close, volume, 'bid', volatility);
  const askLevels = generateLevels(close, volume, 'ask', volatility);

  return {
    symbol: kline.symbol,
    timestamp: kline.closeTime,
    price: close,
    bids: bidLevels,
    asks: askLevels,
    isSynthetic: true,
    label: 'SYNTHETIC BOOK SIMULATION',
  };
}

/**
 * Generate order book levels
 */
function generateLevels(
  price: number,
  volume: number,
  side: 'bid' | 'ask',
  volatility: number
): Array<[string, string]> {
  const levels: Array<[string, string]> = [];
  const levelCount = 20;
  const baseQuantity = volume / 1000; // Distribute volume across levels

  for (let i = 0; i < levelCount; i++) {
    // Price distance increases exponentially from center
    const distance = (i + 1) * volatility * price * (1 + i * 0.1);
    const levelPrice = side === 'bid' ? price - distance : price + distance;

    // Quantity decreases as we move away from center
    const quantity = baseQuantity * Math.exp(-i * 0.15);

    levels.push([levelPrice.toFixed(2), quantity.toFixed(8)]);
  }

  return levels;
}

/**
 * Simulate trading strategy on historical klines
 */
export function backtestStrategy(
  klines: Kline[],
  strategyFunction: (kline: Kline, index: number) => 'long' | 'short' | 'none'
): BacktestResult {
  if (klines.length < 2) {
    throw new Error('Need at least 2 klines for backtesting');
  }

  const symbol = klines[0].symbol;
  const startTime = klines[0].openTime;
  const endTime = klines[klines.length - 1].closeTime;
  const startPrice = parseFloat(klines[0].open);
  const endPrice = parseFloat(klines[klines.length - 1].close);

  let totalTrades = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalPnL = 0;
  let maxDrawdown = 0;
  let currentDrawdown = 0;
  let peakPrice = startPrice;

  // Simulate trades
  for (let i = 0; i < klines.length - 1; i++) {
    const signal = strategyFunction(klines[i], i);
    if (signal === 'none') continue;

    const entryPrice = parseFloat(klines[i].close);
    const exitPrice = parseFloat(klines[i + 1].close);

    let pnl = 0;
    if (signal === 'long') {
      pnl = (exitPrice - entryPrice) / entryPrice;
    } else {
      pnl = (entryPrice - exitPrice) / entryPrice;
    }

    totalTrades++;
    totalPnL += pnl;

    if (pnl > 0) {
      winningTrades++;
    } else {
      losingTrades++;
    }

    // Track drawdown
    if (exitPrice > peakPrice) {
      peakPrice = exitPrice;
      currentDrawdown = 0;
    } else {
      currentDrawdown = (peakPrice - exitPrice) / peakPrice;
      maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
    }
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const totalPnLPercent = (totalPnL / totalTrades) * 100;

  // Calculate Sharpe Ratio (simplified)
  const sharpeRatio = calculateSharpeRatio(klines);

  return {
    symbol,
    startTime,
    endTime,
    startPrice,
    endPrice,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    totalPnL,
    totalPnLPercent,
    maxDrawdown,
    sharpeRatio,
    isSynthetic: true,
    label: 'SYNTHETIC BACKTEST RESULTS',
  };
}

/**
 * Calculate Sharpe Ratio from klines
 */
function calculateSharpeRatio(klines: Kline[]): number {
  if (klines.length < 2) return 0;

  // Calculate returns
  const returns: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const prevClose = parseFloat(klines[i - 1].close);
    const currClose = parseFloat(klines[i].close);
    const ret = (currClose - prevClose) / prevClose;
    returns.push(ret);
  }

  // Calculate mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Calculate standard deviation
  const variance =
    returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Sharpe Ratio (assuming 0% risk-free rate)
  return stdDev > 0 ? meanReturn / stdDev : 0;
}

/**
 * Compare live signals with backtest results
 */
export function compareSignals(
  liveSignal: number,
  backtestWinRate: number
): {
  agreement: number;
  confidence: number;
  recommendation: string;
} {
  // Check if live signal and backtest results agree
  const liveIsBullish = liveSignal > 0;
  const backtestIsBullish = backtestWinRate > 50;

  const agreement = liveIsBullish === backtestIsBullish ? 1 : 0;
  const confidence = Math.abs(backtestWinRate - 50) / 50; // 0-1 scale

  let recommendation = '';
  if (agreement === 1 && confidence > 0.6) {
    recommendation = 'STRONG AGREEMENT: Live and backtest signals align with high confidence';
  } else if (agreement === 1) {
    recommendation = 'MODERATE AGREEMENT: Live and backtest signals align';
  } else if (agreement === 0 && confidence > 0.6) {
    recommendation = 'STRONG DIVERGENCE: Live and backtest signals disagree';
  } else {
    recommendation = 'WEAK DIVERGENCE: Live and backtest signals show mixed signals';
  }

  return { agreement, confidence, recommendation };
}

/**
 * Generate backtest report with synthetic label
 */
export function generateBacktestReport(result: BacktestResult): string {
  return `
╔════════════════════════════════════════════════════════════════╗
║                 SYNTHETIC BACKTEST RESULTS                     ║
║                  (Simulation Only - Not Real)                  ║
╚════════════════════════════════════════════════════════════════╝

Symbol: ${result.symbol}
Period: ${new Date(result.startTime).toISOString()} to ${new Date(result.endTime).toISOString()}

Price Performance:
  Start Price: $${result.startPrice.toFixed(2)}
  End Price: $${result.endPrice.toFixed(2)}
  Change: ${(((result.endPrice - result.startPrice) / result.startPrice) * 100).toFixed(2)}%

Trading Statistics:
  Total Trades: ${result.totalTrades}
  Winning Trades: ${result.winningTrades}
  Losing Trades: ${result.losingTrades}
  Win Rate: ${result.winRate.toFixed(2)}%

Performance Metrics:
  Total P&L: ${result.totalPnL.toFixed(4)} (${result.totalPnLPercent.toFixed(2)}%)
  Max Drawdown: ${(result.maxDrawdown * 100).toFixed(2)}%
  Sharpe Ratio: ${result.sharpeRatio.toFixed(4)}

⚠️  IMPORTANT DISCLAIMER:
This is a SYNTHETIC BACKTEST using simulated order books generated from kline data.
Results are for educational purposes only and do NOT represent actual trading results.
Past performance does not guarantee future results.
`;
}
