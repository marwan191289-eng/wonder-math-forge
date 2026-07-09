export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBase: number;
  takerBuyQuote: number;
}

export interface DepthLevel {
  price: number;
  qty: number;
}

export interface Depth {
  lastUpdateId: number;
  bids: DepthLevel[];
  asks: DepthLevel[];
}

// Alias used by the V2 analytics engine (Python-port terminology).
export type OrderBook = Depth;

export interface AggTrade {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean; // true => market sell hit bid
}

export interface Ticker24h {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
}
