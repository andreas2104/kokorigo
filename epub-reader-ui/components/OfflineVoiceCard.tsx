"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, CloudDownload, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  LOCAL_PIPER_MODEL_MEGABYTES,
  LOCAL_PIPER_VOICE_ID,
  describeLocalPiperSupport,
  installLocalPiper,
  isLocalPiperInstalled,
  removeLocalPiper,
} from "@/lib/piper-local";

type Props = {
  onInstalled?: (voiceId: string) => void;
};

// Télécharge une fois le modèle Piper du serveur pour que la même voix soit
// synthétisée par le téléphone, sans réseau.
export default function OfflineVoiceCard({ onInstalled }: Props) {
  const queryClient = useQueryClient();
  const [support, setSupport] = useState({ supported: false, reason: "" });
  const [installed, setInstalled] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupport(describeLocalPiperSupport());
    void isLocalPiperInstalled().then(setInstalled);
  }, []);

  if (!support.supported) {
    if (!support.reason) return null;
    return (
      <section className="mt-3 rounded-xl border border-[#f0dfc7] bg-[#fff9ef] p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#9a5000] dark:text-amber-300">
          <AlertCircle className="h-4 w-4" /> Voix Piper hors ligne indisponible
        </p>
        <p className="mt-2 text-xs leading-5 text-[#6e7480] dark:text-slate-400">{support.reason}</p>
      </section>
    );
  }

  const refreshVoices = () => queryClient.invalidateQueries({ queryKey: ["voices"] });

  const install = async () => {
    setError(null);
    setProgress(0);
    try {
      await installLocalPiper(setProgress);
      setInstalled(true);
      await refreshVoices();
      // Sans cela, la lecture continuerait d'utiliser la voix du serveur alors
      // que l'utilisateur vient justement de télécharger la voix embarquée.
      onInstalled?.(LOCAL_PIPER_VOICE_ID);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Téléchargement impossible.");
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await removeLocalPiper();
      setInstalled(false);
      await refreshVoices();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suppression impossible.");
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-[#ece5dc] p-3 dark:border-slate-800">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <CloudDownload className="h-4 w-4 text-[#c66600]" /> Voix Piper hors ligne
      </p>

      {installed ? (
        <>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="h-4 w-4 shrink-0" /> Installée et sélectionnée : « Siwis · Piper embarqué » lit sans réseau.
          </p>
          <button
            type="button"
            onClick={() => void remove()}
            className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#e8e2da] text-sm font-medium text-[#687185] hover:bg-[#f7f5f2] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Trash2 className="h-4 w-4" /> Supprimer la voix téléchargée
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-xs leading-5 text-[#768096] dark:text-slate-400">
            Télécharge le modèle du serveur et son moteur (environ {LOCAL_PIPER_MODEL_MEGABYTES} Mo,
            une seule fois) pour que ce téléphone fabrique lui-même la voix, sans connexion.
          </p>
          <button
            type="button"
            onClick={() => void install()}
            disabled={progress !== null}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#c76800] text-sm font-semibold text-white disabled:opacity-60"
          >
            {progress === null ? (
              <>
                <CloudDownload className="h-4 w-4" /> Télécharger la voix
              </>
            ) : (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress < 1 ? `${Math.round(progress * 100)} %` : "Préparation de la voix…"}
              </>
            )}
          </button>
          {progress !== null && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#f0e7da] dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-[#c76800] transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </>
      )}

      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}
    </section>
  );
}
