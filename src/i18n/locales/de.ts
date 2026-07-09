import type { Dict } from "./en";
const de: Dict = {
  nav: {
    home: "Startseite",
    trading: "Trading",
    quant: "Quant-Terminal",
    backtest: "Backtest",
    compare: "Live vs Backtest",
    report: "Bericht",
  },
  common: {
    language: "Sprache",
    settings: "Einstellungen",
    balance: "Kontostand",
    pnl: "Sitzungs-PnL",
    live: "Live",
    sim: "Simulation",
    tryAgain: "Erneut versuchen",
    goHome: "Zur Startseite",
    ticks: "Ticks",
  },
  quant: {
    title: "FLUX · Quant-Terminal",
    liveNotice: "Live-Modus angefordert — dieses Terminal sendet designbedingt simulierte Marktdaten.",
    tabs: { regime: "Regime", toxicity: "Toxizität", sizer: "Sizer", arbitrage: "Arbitrage" },
  },
  errors: {
    notFound: "Seite nicht gefunden",
    notFoundDesc: "Die gesuchte Seite existiert nicht oder wurde verschoben.",
    crashed: "Diese Seite konnte nicht geladen werden",
    crashedDesc: "Etwas ist schiefgelaufen. Bitte versuche es erneut oder gehe zurück.",
  },
};
export default de;
