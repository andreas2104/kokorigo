"use client";

import { BookOpen, Moon, Settings, Sun, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

type Props = {
  onImport: () => void;
  onOpenSettings: () => void;
};

type Theme = "dark" | "light";

const THEME_KEY = "kokorigo:theme";

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
}

export default function AppHeader({ onImport, onOpenSettings }: Props) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem(THEME_KEY, next);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-lg shadow-primary/25">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold tracking-tight">
              Kokorigo
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Bibliothèque EPUB
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden sm:block">
            <StatusBadge />
          </div>

          <button
            type="button"
            onClick={onImport}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-gradient px-3.5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95 sm:px-4"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Importer un EPUB</span>
            <span className="sm:hidden">Importer</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Passer au mode clair" : "Passer au mode sombre"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Paramètres"
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl",
              "border border-border bg-card text-muted-foreground transition-colors hover:text-foreground",
            )}
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}