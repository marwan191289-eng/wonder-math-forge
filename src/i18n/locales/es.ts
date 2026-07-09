import type { Dict } from "./en";
const es: Dict = {
  nav: {
    home: "Inicio",
    trading: "Trading",
    quant: "Terminal Cuantitativo",
    backtest: "Backtest",
    compare: "En vivo vs Backtest",
    report: "Informe",
  },
  common: {
    language: "Idioma",
    settings: "Ajustes",
    balance: "Saldo",
    pnl: "PnL de sesión",
    live: "En vivo",
    sim: "Simulado",
    tryAgain: "Reintentar",
    goHome: "Ir al inicio",
    ticks: "Ticks",
  },
  quant: {
    title: "FLUX · Terminal Cuantitativo",
    liveNotice: "Modo en vivo solicitado — este terminal emite datos simulados por diseño.",
    tabs: { regime: "Régimen", toxicity: "Toxicidad", sizer: "Tamaño", arbitrage: "Arbitraje" },
  },
  errors: {
    notFound: "Página no encontrada",
    notFoundDesc: "La página que buscas no existe o ha sido movida.",
    crashed: "Esta página no cargó",
    crashedDesc: "Algo salió mal. Puedes reintentar o volver al inicio.",
  },
};
export default es;
