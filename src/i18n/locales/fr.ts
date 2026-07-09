import type { Dict } from "./en";
const fr: Dict = {
  nav: {
    home: "Accueil",
    trading: "Trading",
    quant: "Terminal Quant",
    backtest: "Backtest",
    compare: "Live vs Backtest",
    report: "Rapport",
  },
  common: {
    language: "Langue",
    settings: "Paramètres",
    balance: "Solde",
    pnl: "PnL de session",
    live: "En direct",
    sim: "Simulé",
    tryAgain: "Réessayer",
    goHome: "Retour à l'accueil",
    ticks: "Ticks",
  },
  quant: {
    title: "FLUX · Terminal Quant",
    liveNotice: "Mode direct demandé — ce terminal diffuse des données simulées par conception.",
    tabs: { regime: "Régime", toxicity: "Toxicité", sizer: "Taille", arbitrage: "Arbitrage" },
  },
  errors: {
    notFound: "Page introuvable",
    notFoundDesc: "La page que vous cherchez n'existe pas ou a été déplacée.",
    crashed: "Cette page n'a pas chargé",
    crashedDesc: "Une erreur est survenue. Réessayez ou revenez à l'accueil.",
  },
};
export default fr;
