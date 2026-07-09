import type { Dict } from "./en";
const hi: Dict = {
  nav: {
    home: "होम",
    trading: "ट्रेडिंग",
    quant: "क्वांट टर्मिनल",
    backtest: "बैकटेस्ट",
    compare: "लाइव बनाम बैकटेस्ट",
    report: "रिपोर्ट",
  },
  common: {
    language: "भाषा",
    settings: "सेटिंग्स",
    balance: "बैलेंस",
    pnl: "सत्र PnL",
    live: "लाइव",
    sim: "सिमुलेशन",
    tryAgain: "पुनः प्रयास",
    goHome: "होम पर जाएं",
    ticks: "टिक्स",
  },
  quant: {
    title: "FLUX · क्वांट टर्मिनल",
    liveNotice: "लाइव मोड अनुरोधित — यह टर्मिनल डिज़ाइन द्वारा सिम्युलेटेड डेटा प्रसारित करता है।",
    tabs: { regime: "रेजीम", toxicity: "टॉक्सिसिटी", sizer: "साइज़र", arbitrage: "आर्बिट्राज" },
  },
  errors: {
    notFound: "पृष्ठ नहीं मिला",
    notFoundDesc: "आप जो पृष्ठ खोज रहे हैं वह मौजूद नहीं है या स्थानांतरित कर दिया गया है।",
    crashed: "यह पृष्ठ लोड नहीं हुआ",
    crashedDesc: "कुछ गलत हुआ। पुनः प्रयास करें या होम पर जाएं।",
  },
};
export default hi;
