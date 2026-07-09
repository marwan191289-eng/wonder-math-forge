import type { Dict } from "./en";
const ru: Dict = {
  nav: {
    home: "Главная",
    trading: "Торговля",
    quant: "Квант-терминал",
    backtest: "Бэктест",
    compare: "Live vs Backtest",
    report: "Отчёт",
  },
  common: {
    language: "Язык",
    settings: "Настройки",
    balance: "Баланс",
    pnl: "PnL сессии",
    live: "Живой",
    sim: "Симуляция",
    tryAgain: "Повторить",
    goHome: "На главную",
    ticks: "Тики",
  },
  quant: {
    title: "FLUX · Квант-терминал",
    liveNotice: "Запрошен режим Live — этот терминал по замыслу транслирует симулированные данные.",
    tabs: { regime: "Режим", toxicity: "Токсичность", sizer: "Размер", arbitrage: "Арбитраж" },
  },
  errors: {
    notFound: "Страница не найдена",
    notFoundDesc: "Запрашиваемая страница не существует или была перемещена.",
    crashed: "Эта страница не загрузилась",
    crashedDesc: "Что-то пошло не так. Обновите или вернитесь на главную.",
  },
};
export default ru;
