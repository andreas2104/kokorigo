"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBackendStatus, type BackendStatus } from "@/hooks/useBackendStatus";

const LABELS: Record<BackendStatus, string> = {
  checking: "Vérification…",
  connected: "Service vocal · Connecté",
  offline: "Mode local",
};

const STYLES: Record<BackendStatus, string> = {
  checking: "border-border text-muted-foreground",
  connected: "border-emerald-500/30 text-emerald-400",
  offline: "border-amber-500/30 text-amber-400",
};

const DOT_STYLES: Record<BackendStatus, string> = {
  checking: "bg-muted-foreground",
  connected: "bg-emerald-400",
  offline: "bg-amber-400",
};

export default function StatusBadge() {
  const { status, known, check } = useBackendStatus();

  return (
    <button
      type="button"
      onClick={() => void check()}
      title="Cliquer pour revérifier la connexion au service de synthèse vocale"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/60",
        STYLES[status],
      )}
    >
      <span className="relative flex h-2 w-2">
        {known && status !== "checking" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              DOT_STYLES[status],
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            DOT_STYLES[status],
          )}
        />
      </span>
      {LABELS[status]}
      {status === "checking" && (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
      )}
    </button>
  );
}
