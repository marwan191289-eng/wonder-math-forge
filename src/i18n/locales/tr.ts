import type { Dict } from "./en";
const tr: Dict = {
  nav: {
    home: "Ana Sayfa",
    trading: "İşlem",
    quant: "Kantitatif Terminal",
    backtest: "Backtest",
    compare: "Canlı - Backtest",
    report: "Rapor",
  },
  common: {
    language: "Dil",
    settings: "Ayarlar",
    balance: "Bakiye",
    pnl: "Oturum K/Z",
    live: "Canlı",
    sim: "Simülasyon",
    tryAgain: "Tekrar dene",
    goHome: "Ana sayfa",
    ticks: "Tikler",
  },
  quant: {
    title: "FLUX · Kantitatif Terminal",
    liveNotice: "Canlı mod istendi — bu terminal tasarım gereği simüle veri yayınlar.",
    tabs: { regime: "Rejim", toxicity: "Toksisite", sizer: "Boyut", arbitrage: "Arbitraj" },
  },
  errors: {
    notFound: "Sayfa bulunamadı",
    notFoundDesc: "Aradığınız sayfa mevcut değil veya taşındı.",
    crashed: "Bu sayfa yüklenmedi",
    crashedDesc: "Bir sorun oluştu. Yenilemeyi deneyin veya ana sayfaya dönün.",
  },
};
export default tr;
