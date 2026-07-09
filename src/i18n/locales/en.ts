const en = {
  nav: {
    home: "Home",
    trading: "Trading",
    quant: "Quant Terminal",
    backtest: "Backtest",
    compare: "Live vs Backtest",
    report: "Report",
  },
  common: {
    language: "Language",
    settings: "Settings",
    balance: "Balance",
    pnl: "Session PnL",
    live: "Live",
    sim: "Sim",
    tryAgain: "Try again",
    goHome: "Go home",
    ticks: "Ticks",
  },
  quant: {
    title: "FLUX · Quant Terminal",
    liveNotice: "Live mode requested — this terminal streams simulated market data by design.",
    tabs: {
      regime: "Regime",
      toxicity: "Toxicity",
      sizer: "Sizer",
      arbitrage: "Arbitrage",
    },
  },
  errors: {
    notFound: "Page not found",
    notFoundDesc: "The page you're looking for doesn't exist or has been moved.",
    crashed: "This page didn't load",
    crashedDesc: "Something went wrong. You can try refreshing or head back home.",
  },
};
export default en;
export type Dict = typeof en;
