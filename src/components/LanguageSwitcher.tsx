import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LANGUAGES, RTL_LANGS } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    if (typeof document === "undefined") return;
    const dir = RTL_LANGS.has(i18n.language) ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", i18n.language);
  }, [i18n.language]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-medium"
          aria-label="Change language"
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{current.flag}</span>
          {!compact && <span>{current.native}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onSelect={() => i18n.changeLanguage(l.code)}
            className={l.code === current.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{l.flag}</span>
            <span className="flex-1">{l.native}</span>
            <span className="text-xs text-muted-foreground ml-2">{l.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
