import type { Dict } from "./en";
const zh: Dict = {
  nav: {
    home: "首页",
    trading: "交易",
    quant: "量化终端",
    backtest: "回测",
    compare: "实时对比回测",
    report: "报告",
  },
  common: {
    language: "语言",
    settings: "设置",
    balance: "余额",
    pnl: "本轮盈亏",
    live: "实时",
    sim: "模拟",
    tryAgain: "重试",
    goHome: "回到首页",
    ticks: "行情",
  },
  quant: {
    title: "FLUX · 量化终端",
    liveNotice: "已请求实时模式 — 本终端按设计推送模拟市场数据。",
    tabs: { regime: "状态", toxicity: "毒性", sizer: "仓位", arbitrage: "套利" },
  },
  errors: {
    notFound: "页面未找到",
    notFoundDesc: "您访问的页面不存在或已被移动。",
    crashed: "此页面未能加载",
    crashedDesc: "出了点问题。请刷新或返回首页。",
  },
};
export default zh;
