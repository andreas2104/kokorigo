"use client";

import {
  CheckCircle2,
  Cpu,
  Database,
  Headphones,
  Monitor,
  Server,
  ShieldCheck,
  Volume2,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { API_BASE_URL, TTS_API_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

type Props = {
  onClose: () => void;
};

const PIPER_MODEL = "fr_FR-siwis-medium";

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <code className="block truncate text-sm font-medium text-foreground">{value}</code>
      </span>
    </li>
  );
}

export default function SettingsDialog({ onClose }: Props) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paramètres"
        onClick={(event) => event.stopPropagation()}
        className="my-10 w-full max-w-lg animate-scale-in rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-7"
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold tracking-tight">Paramètres</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer les paramètres"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-1.5 text-sm text-muted-foreground">
          Configuration du service de synthèse vocale et de l'application.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-emerald-400">Piper TTS opérationnel</p>
            <p className="text-xs text-emerald-300/70">
              Modèle {PIPER_MODEL} · synthèse 100% locale (CPU)
            </p>
          </div>
        </div>

        <section className="mt-7">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Headphones className="h-4 w-4" aria-hidden="true" /> Synthèse vocale
          </h3>
          <ul className="space-y-2.5">
            <Row icon={<Volume2 className="h-4 w-4" />} label="Moteur" value="Piper TTS" />
            <Row icon={<Cpu className="h-4 w-4" />} label="Modèle vocal" value={PIPER_MODEL} />
            <Row icon={<Monitor className="h-4 w-4" />} label="Vitesse de lecture" value="1× · 1.25× · 1.5×" />
          </ul>
        </section>

        <section className="mt-7">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Server className="h-4 w-4" aria-hidden="true" /> API & stockage
          </h3>
          <ul className="space-y-2.5">
            <Row icon={<Server className="h-4 w-4" />} label="API de bibliothèque (C#)" value={API_BASE_URL} />
            <Row icon={<Headphones className="h-4 w-4" />} label="API Piper TTS" value={TTS_API_URL} />
            <Row icon={<Database className="h-4 w-4" />} label="Stockage" value="Local · navigation + dossier serveur" />
          </ul>
        </section>

        <div className="mt-7 flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">
            Confidentialité : l'extraction du texte s'effectue dans votre
            navigateur. Seuls les paragraphes sélectionnés pour la lecture sont
            envoyés au moteur Piper TTS local. Vos fichiers ne quittent jamais
            votre appareil.
          </p>
        </div>

        <div className="mt-7 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-primary-foreground",
              "shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95",
            )}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}