"use client";

import {
  Gauge,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BookItem } from "@/types/book";
import { useVoices } from "@/hooks/useVoices";
import { cn } from "@/lib/utils";

type Props = {
  book: BookItem;
  onClose: () => void;
};

const SPEEDS = [1, 1.25, 1.5];
const DURATION = 5 * 60; // lecture de démonstration ~5 min

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export default function MiniPlayer({ book, onClose }: Props) {
  const voicesQuery = useVoices();
  const voices = voicesQuery.data ?? [];

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(80);
  const [voiceId, setVoiceId] = useState("ff_siwis");

  const currentVoice = useMemo(
    () => voices.find((voice) => voice.id === voiceId) ?? voices[0],
    [voices, voiceId],
  );

  useEffect(() => {
    const first = voices[0];
    if (first && !voices.some((voice) => voice.id === voiceId)) {
      setVoiceId(first.id);
    }
  }, [voices, voiceId]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setCurrentTime((time) => {
        if (time + 1 >= DURATION) {
          setIsPlaying(false);
          return DURATION;
        }
        return time + 1;
      });
    }, 1000 / speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, speed]);

  const progress = Math.min(100, (currentTime / DURATION) * 100);
  const chapterLabel = book.progress
    ? `Chapitre ${book.progress.chapter}/${book.progress.totalChapters}`
    : "Chapitre 1";

  return (
    <div
      className="fixed inset-x-0 bottom-4 z-40 mx-auto w-[calc(100%-2rem)] max-w-3xl animate-fade-up rounded-2xl border border-border bg-card/80 p-4 shadow-2xl backdrop-blur-xl sm:p-5"
      role="region"
      aria-label="Lecteur audio"
    >
      <div className="flex flex-wrap items-center gap-4">
        {book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt=""
            className="h-14 w-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-white">
            <Gauge className="h-5 w-5" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{book.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {book.author} · {chapterLabel}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatTime(currentTime)}
            </span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-gradient"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatTime(DURATION)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setVolume((value) => (value === 0 ? 80 : 0))}
            aria-label={volume === 0 ? "Activer le son" : "Couper le son"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-colors hover:text-foreground"
          >
            {volume === 0 ? (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label="Volume"
            className="hidden w-24 sm:block"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsPlaying((value) => !value)}
          aria-label={isPlaying ? "Pause" : "Lecture"}
          className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-white shadow-lg shadow-primary/30 transition-all hover:opacity-90 active:scale-95"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          aria-label="Changer la vitesse de lecture"
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-xl border px-3 text-xs font-semibold",
            "border-primary/40 bg-primary/10 text-primary transition-colors hover:bg-primary/20",
          )}
        >
          {speed}×
        </button>

        <select
          value={voiceId}
          onChange={(event) => setVoiceId(event.target.value)}
          aria-label="Voix Piper TTS"
          className={cn(
            "h-9 max-w-[8.5rem] rounded-xl border border-border bg-card px-2 text-xs font-medium",
            "text-foreground focus:border-primary focus:outline-none",
          )}
        >
          {voices.length > 0
            ? voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))
            : (
              <option value={voiceId}>{currentVoice?.name ?? "Voix par défaut"}</option>
            )}
        </select>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer le lecteur"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}