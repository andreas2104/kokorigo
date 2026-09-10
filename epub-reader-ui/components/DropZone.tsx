"use client";

import { AlertCircle, FolderOpen, ShieldCheck, Upload, Volume2 } from "lucide-react";
import { useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onFile: (file: File) => void;
  onBrowse: () => void;
  error: string | null;
};

export default function DropZone({ onFile, onBrowse, error }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "group relative overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-12",
        dragging
          ? "scale-[1.01] border-primary bg-primary/10"
          : "border-border bg-card/60 backdrop-blur-sm hover:border-primary/50",
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.06] transition-opacity",
          dragging && "opacity-15",
        )}
      />

      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-xl shadow-primary/30 transition-transform duration-300",
            dragging ? "scale-110" : "group-hover:scale-105",
          )}
        >
          <Upload className="h-7 w-7" aria-hidden="true" />
        </div>

        <h2 className="max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
          Glissez votre fichier EPUB ici
        </h2>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
          ou parcourez vos dossiers pour importer un livre. Le texte est extrait
          localement dans votre navigateur, puis lu à la demande par Piper, Kokoro ou F5-TTS.
        </p>

        <button
          type="button"
          onClick={onBrowse}
          className={cn(
            "mt-7 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-5 py-3",
            "text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25",
            "transition-all hover:opacity-90 active:scale-95",
          )}
        >
          <FolderOpen className="h-4 w-4" aria-hidden="true" />
          Parcourir mes fichiers
        </button>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            100% Confidentiel · Traitement local
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            <Volume2 className="h-3.5 w-3.5 text-indigo-400" aria-hidden="true" />
            Synthèse vocale Piper + Kokoro + F5-TTS
          </span>
        </div>

        {error && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
