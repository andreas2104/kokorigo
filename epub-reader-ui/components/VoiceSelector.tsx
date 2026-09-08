"use client";

import { Check, ChevronDown, Loader2, Play, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Voice } from "@/types/voice";
import { requestTtsAudio } from "@/hooks/useAudioTTS";

type Props = {
  voices: Voice[];
  selectedVoiceId: string;
  onChange: (voiceId: string) => void;
  disabled?: boolean;
};

export default function VoiceSelector({ voices, selectedVoiceId, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const selectedVoice = voices.find((voice) => voice.id === selectedVoiceId) ?? voices[0];
  const groupedVoices = useMemo(() => {
    return voices.reduce<Record<string, Voice[]>>((groups, voice) => {
      (groups[voice.character || "Autres"] ??= []).push(voice);
      return groups;
    }, {});
  }, [voices]);

  useEffect(() => () => stopPreview(), []);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewingId(null);
  };

  const preview = async (voice: Voice) => {
    if (previewingId === voice.id) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewError(null);
    setPreviewingId(voice.id);
    try {
      const url = await requestTtsAudio(
        `Bonjour. Je suis ${voice.name}, une voix disponible pour la narration de vos livres.`,
        { voice: voice.id, speed: 1 },
      );
      previewUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stopPreview;
      await audio.play();
    } catch {
      stopPreview();
      setPreviewError("Extrait indisponible");
    }
  };

  if (!voices.length) {
    return <span className="text-xs text-slate-400">Aucune voix disponible</span>;
  }

  return (
    <div className="relative min-w-[15rem]">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-lg bg-slate-800 px-3 py-2 text-left text-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{selectedVoice?.name ?? "Choisir une voix"}</span>
          <span className="block text-xs text-slate-400">{selectedVoice?.character ?? ""}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-20 mb-2 max-h-80 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl" role="listbox" aria-label="Voix et personnages">
          {Object.entries(groupedVoices).map(([character, characterVoices]) => (
            <div key={character}>
              <p className="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{character}</p>
              {characterVoices.map((voice) => (
                <div key={voice.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-slate-800">
                  <button
                    type="button"
                    role="option"
                    aria-selected={voice.id === selectedVoiceId}
                    onClick={() => { onChange(voice.id); setOpen(false); setPreviewError(null); }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {voice.id === selectedVoiceId ? <Check className="h-4 w-4 shrink-0 text-indigo-400" /> : <span className="w-4" />}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{voice.name}</span>
                      {voice.description && <span className="block truncate text-xs text-slate-400">{voice.description}</span>}
                    </span>
                  </button>
                  <button type="button" onClick={() => void preview(voice)} className="rounded-md p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white" aria-label={`${previewingId === voice.id ? "Arrêter" : "Écouter"} un extrait de ${voice.name}`}>
                    {previewingId === voice.id ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </div>
          ))}
          {previewingId && <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin text-indigo-400" aria-label="Chargement de l'extrait" />}
          {previewError && <p className="px-2 pt-2 text-xs text-red-300">{previewError}</p>}
        </div>
      )}
    </div>
  );
}
