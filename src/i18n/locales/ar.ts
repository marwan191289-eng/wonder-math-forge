import type { Dict } from "./en";
const ar: Dict = {
  nav: {
    home: "الرئيسية",
    trading: "التداول",
    quant: "الطرفية الكمية",
    backtest: "الاختبار الخلفي",
    compare: "مباشر مقابل اختبار",
    report: "التقرير",
  },
  common: {
    language: "اللغة",
    settings: "الإعدادات",
    balance: "الرصيد",
    pnl: "ربح الجلسة",
    live: "مباشر",
    sim: "محاكاة",
    tryAgain: "حاول مجدداً",
    goHome: "العودة للرئيسية",
    ticks: "الحركات",
  },
  quant: {
    title: "فلَكس · الطرفية الكمية",
    liveNotice: "الوضع المباشر مطلوب — هذه الطرفية تبثّ بيانات محاكاة بالتصميم.",
    tabs: {
      regime: "النظام",
      toxicity: "السمّية",
      sizer: "حجم المركز",
      arbitrage: "المراجحة",
    },
  },
  errors: {
    notFound: "الصفحة غير موجودة",
    notFoundDesc: "الصفحة التي تبحث عنها غير موجودة أو تم نقلها.",
    crashed: "لم يتم تحميل الصفحة",
    crashedDesc: "حدث خطأ ما. حاول التحديث أو العودة للرئيسية.",
  },
};
export default ar;
