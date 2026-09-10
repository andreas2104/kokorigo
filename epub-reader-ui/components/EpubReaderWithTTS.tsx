"use client";

import JSZip from "jszip";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioTTS } from "@/hooks/useAudioTTS";
import { useVoices } from "@/hooks/useVoices";
import VoiceSelector from "@/components/VoiceSelector";
import { buildWordTimings, tokenizeText, wordIndexAtProgress } from "@/lib/word-timing";

type Paragraph = { id: number; text: string };

type Props = {
  file: File;
  onClose: () => void;
  embedded?: boolean;
  voiceId?: string;
  onVoiceChange?: (voiceId: string) => void;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
};

function splitParagraphs(html: string, startAt: number): Paragraph[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const elements = Array.from(document.body.querySelectorAll("p, li, blockquote, h1, h2, h3, h4"));
  const source = elements.length ? elements : [document.body];

  return source
    .map((element, offset) => ({
      id: startAt + offset,
      text: (element.textContent ?? "").replace(/\s+/g, " ").trim(),
    }))
    .filter((paragraph) => paragraph.text.length > 0);
}

async function extractParagraphs(file: File): Promise<Paragraph[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const readXml = async (path: string) => {
    const entry = zip.file(path);
    if (!entry) throw new Error(`EPUB file missing: ${path}`);
    return new DOMParser().parseFromString(await entry.async("text"), "application/xml");
  };
  const directory = (path: string) => path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : "";
  const resolvePath = (base: string, href: string) => {
    const parts = `${directory(base)}${decodeURIComponent(href.split("#")[0])}`.split("/");
    const resolved: string[] = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") resolved.pop();
      else resolved.push(part);
    }
    return resolved.join("/");
  };

  const container = await readXml("META-INF/container.xml");
  const opfPath = container.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB container has no package document");

  const opf = await readXml(opfPath);
  const manifest = new Map(
    Array.from(opf.querySelectorAll("manifest > item")).map((item) => [
      item.getAttribute("id") ?? "",
      resolvePath(opfPath, item.getAttribute("href") ?? ""),
    ]),
  );
  const spinePaths = Array.from(opf.querySelectorAll("spine > itemref"))
    .map((item) => manifest.get(item.getAttribute("idref") ?? ""))
    .filter((path): path is string => Boolean(path));
  // A few EPUB producers leave a stale filename in the OPF. If a spine item
  // is missing, use the matching XHTML/HTML archive entry when available.
  const archiveChapters = Object.values(zip.files)
    .filter((entry) => !entry.dir && /\.(x?html?|xml)$/i.test(entry.name))
    .map((entry) => entry.name);
  const chapterPaths = spinePaths.length ? spinePaths : archiveChapters;
  const readableChapterPaths = chapterPaths.map((path) =>
    zip.file(path) ? path : archiveChapters.find((candidate) => candidate.endsWith(path.split("/").pop() ?? "")) ?? path,
  );
  if (!readableChapterPaths.length) throw new Error("EPUB has no readable chapters");

  const chapters = await Promise.allSettled(readableChapterPaths.map(async (path) => {
    const entry = zip.file(path);
    if (!entry) throw new Error(`EPUB chapter missing: ${path}`);
    return entry.async("text");
  }));
  const paragraphs = chapters.flatMap((result, index) =>
    result.status === "fulfilled" ? splitParagraphs(result.value, index * 10000) : [],
  );
  if (!paragraphs.length) throw new Error("EPUB contains no readable text");
  return paragraphs;
}

export default function EpubReaderWithTTS({
  file,
  onClose,
  embedded = false,
  voiceId,
  onVoiceChange,
  playbackSpeed,
  onPlaybackSpeedChange,
}: Props) {
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [internalVoiceId, setInternalVoiceId] = useState("piper:ff_siwis");
  const [internalSpeed, setInternalSpeed] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicesQuery = useVoices();
  const selectedVoiceId = voiceId ?? internalVoiceId;
  const speed = playbackSpeed ?? internalSpeed;
  const setSelectedVoiceId = onVoiceChange ?? setInternalVoiceId;
  const setSpeed = onPlaybackSpeedChange ?? setInternalSpeed;

  useEffect(() => {
    const firstVoice = voicesQuery.data?.find((voice) => voice.available);
    if (firstVoice && !voicesQuery.data?.some((voice) => voice.id === selectedVoiceId && voice.available)) {
      setSelectedVoiceId(firstVoice.id);
    }
  }, [selectedVoiceId, voicesQuery.data]);

  useEffect(() => {
    let cancelled = false;
    setParagraphs([]);
    setActiveIndex(0);
    setIsPlaying(false);
    setActiveWordIndex(null);
    setLoadError(null);
    void extractParagraphs(file)
      .then((value) => {
        if (!cancelled) setParagraphs(value);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Impossible de lire la structure de cet EPUB.");
      });
    return () => {
      cancelled = true;
      audioRef.current?.pause();
    };
  }, [file]);

  const current = paragraphs[activeIndex];
  const nextText = paragraphs[activeIndex + 1]?.text;
  const currentTokens = useMemo(() => tokenizeText(current?.text ?? ""), [current?.text]);
  const currentWordTimings = useMemo(() => buildWordTimings(currentTokens), [currentTokens]);
  const tts = useAudioTTS(
    current?.text ?? "",
    activeIndex,
    nextText,
    { voice: selectedVoiceId, speed },
    isPlaying,
  );

  useEffect(() => {
    if (isPlaying && tts.data) {
      const audio = new Audio(tts.data);
      audio.playbackRate = speed;
      let animationFrame = 0;
      let cancelled = false;
      const synchronizeWord = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setActiveWordIndex(wordIndexAtProgress(currentWordTimings, audio.currentTime / audio.duration));
        }
        if (!audio.paused && !audio.ended) animationFrame = requestAnimationFrame(synchronizeWord);
      };
      audioRef.current?.pause();
      audioRef.current = audio;
      setActiveWordIndex(currentWordTimings[0]?.wordIndex ?? null);
      void audio.play().then(() => {
        if (!cancelled) animationFrame = requestAnimationFrame(synchronizeWord);
      }).catch(() => {
        // Browser autoplay policies can reject playback after generation.
        // Do not leave the player looking as if it were still generating.
        if (!cancelled) {
          setActiveWordIndex(null);
          setIsPlaying(false);
        }
      });
      audio.onended = () => {
        cancelAnimationFrame(animationFrame);
        setActiveWordIndex(null);
        tts.prefetchNext();
        if (activeIndex < paragraphs.length - 1) setActiveIndex((index) => index + 1);
        else setIsPlaying(false);
      };
      return () => {
        cancelled = true;
        cancelAnimationFrame(animationFrame);
        audio.pause();
        audio.onended = null;
      };
    }
  }, [activeIndex, currentWordTimings, isPlaying, paragraphs.length, selectedVoiceId, speed, tts.data]);

  useEffect(() => {
    if (isPlaying && current) tts.prefetchNext();
  }, [activeIndex, current, isPlaying, speed, selectedVoiceId]);

  const visibleParagraphs = useMemo(() => paragraphs.slice(0, activeIndex + 8), [paragraphs, activeIndex]);

  const play = () => {
    if (!current) return;
    setIsPlaying(true);
  };

  const pause = () => {
    audioRef.current?.pause();
    setActiveWordIndex(null);
    setIsPlaying(false);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, [contenteditable='true']")) return;

      event.preventDefault();
      if (isPlaying) {
        audioRef.current?.pause();
        setActiveWordIndex(null);
        setIsPlaying(false);
      } else if (current) {
        setIsPlaying(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [current, isPlaying]);

  return (
    <div className={embedded
      ? "flex h-[calc(100vh-112px)] min-h-[620px] min-w-0 flex-col overflow-hidden rounded-2xl border border-[#e6ded2] bg-[#111827] text-slate-100 shadow-[0_14px_40px_rgba(58,39,12,.08)]"
      : "fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100"
    }>
      <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{file.name}</p>
          <p className="text-xs text-slate-400">Lecteur EPUB + Piper/Kokoro TTS</p>
        </div>
        <div className="flex items-center gap-2">
          {isPlaying ? (
            <button onClick={pause} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500" aria-label="Pause"><Pause className="h-4 w-4" /> Pause</button>
          ) : (
            <button onClick={play} disabled={!current || tts.isLoading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Lecture"><Play className="h-4 w-4" /> Lire</button>
          )}
          <span className="hidden text-xs text-slate-500 xl:inline">Espace</span>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-800" aria-label="Fermer"><X /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-slate-100 px-4 py-8 text-slate-900">
        <article className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm sm:p-10">
          {!paragraphs.length && !loadError && <p className="text-slate-500">Extraction des paragraphes…</p>}
          {loadError && <p className="text-red-600">{loadError}</p>}
          {visibleParagraphs.map((paragraph) => (
            <p key={paragraph.id} className="mb-5 rounded px-2 text-lg leading-8">
              {paragraph.id === current?.id
                ? currentTokens.map((token, tokenIndex) => token.wordIndex === activeWordIndex
                  ? <mark key={tokenIndex} className="rounded bg-amber-300 px-0.5 text-inherit transition-colors" aria-current="true">{token.text}</mark>
                  : <span key={tokenIndex}>{token.text}</span>)
                : paragraph.text}
            </p>
          ))}
        </article>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          <button onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} className="rounded-lg p-2 hover:bg-slate-800" aria-label="Précédent"><ChevronLeft /></button>
          {isPlaying ? <button onClick={pause} className="rounded-lg bg-indigo-600 p-3 hover:bg-indigo-500" aria-label="Pause"><Pause /></button> : <button onClick={play} disabled={!current || tts.isLoading} className="rounded-lg bg-indigo-600 p-3 hover:bg-indigo-500 disabled:opacity-50" aria-label="Lecture"><Play /></button>}
          <button onClick={() => setActiveIndex((index) => Math.min(paragraphs.length - 1, index + 1))} className="rounded-lg p-2 hover:bg-slate-800" aria-label="Suivant"><ChevronRight /></button>
          <span className="mx-2 text-sm text-slate-400">{activeIndex + 1} / {paragraphs.length || "…"}</span>
          {!embedded && <label className="ml-auto flex items-center gap-2 text-sm text-slate-300"><Volume2 className="h-4 w-4" />
            <VoiceSelector voices={voicesQuery.data ?? []} selectedVoiceId={selectedVoiceId} onChange={setSelectedVoiceId} disabled={voicesQuery.isLoading} />
          </label>}
          {!embedded && <label className="flex items-center gap-2 text-sm text-slate-300">Vitesse
            <select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="rounded bg-slate-800 px-2 py-1"><option value="0.8">0.8×</option><option value="1">1×</option><option value="1.2">1.2×</option><option value="1.5">1.5×</option></select>
          </label>}
          {tts.isLoading && <span className="text-xs text-amber-300">Génération…</span>}
          {tts.isError && <span className="flex items-center gap-1 text-xs text-red-300"><AlertCircle className="h-4 w-4" /> {tts.error instanceof Error ? tts.error.message : "Moteur vocal indisponible"}</span>}
          {tts.data && !isPlaying && <RotateCcw className="h-4 w-4 text-emerald-400" aria-label="Audio en cache" />}
        </div>
      </footer>
    </div>
  );
}
