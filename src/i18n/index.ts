import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en";
import ar from "./locales/ar";
import es from "./locales/es";
import de from "./locales/de";
import ur from "./locales/ur";
import tr from "./locales/tr";
import fr from "./locales/fr";
import ru from "./locales/ru";
import zh from "./locales/zh";
import hi from "./locales/hi";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English", dir: "ltr" as const, flag: "🇬🇧" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" as const, flag: "🇸🇦" },
  { code: "es", label: "Spanish", native: "Español", dir: "ltr" as const, flag: "🇪🇸" },
  { code: "de", label: "German", native: "Deutsch", dir: "ltr" as const, flag: "🇩🇪" },
  { code: "fr", label: "French", native: "Français", dir: "ltr" as const, flag: "🇫🇷" },
  { code: "tr", label: "Turkish", native: "Türkçe", dir: "ltr" as const, flag: "🇹🇷" },
  { code: "ur", label: "Urdu", native: "اردو", dir: "rtl" as const, flag: "🇵🇰" },
  { code: "ru", label: "Russian", native: "Русский", dir: "ltr" as const, flag: "🇷🇺" },
  { code: "zh", label: "Chinese", native: "中文", dir: "ltr" as const, flag: "🇨🇳" },
  { code: "hi", label: "Hindi", native: "हिन्दी", dir: "ltr" as const, flag: "🇮🇳" },
];

export const RTL_LANGS = new Set(LANGUAGES.filter((l) => l.dir === "rtl").map((l) => l.code));

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        ar: { translation: ar },
        es: { translation: es },
        de: { translation: de },
        fr: { translation: fr },
        tr: { translation: tr },
        ur: { translation: ur },
        ru: { translation: ru },
        zh: { translation: zh },
        hi: { translation: hi },
      },
      fallbackLng: "en",
      supportedLngs: LANGUAGES.map((l) => l.code),
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: "flux_lang",
      },
      react: { useSuspense: false },
    });
}

export default i18n;
