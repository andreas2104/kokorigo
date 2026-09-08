"use client";

import {
  BookOpen,
  Gauge,
  Library,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Token = { id: string; text: string };
type Sentence = { id: string; tokens: Token[] };

type ReaderViewProps = {
  bookTitle?: string;
  chapterTitle?: string;
  onBack?: () => void;
};

const DEMO_SENTENCES: Sentence[] = [
  {
    id: "s1",
    tokens: "La nuit avait enveloppé la ville d’un silence presque liquide.".split(" ").map((text, index) => ({ id: `s1-${index}`, text })),
  },
  {
    id: "s2",
    tokens: "Depuis la fenêtre, Élise observait les dernières lumières glisser sur les toits.".split(" ").map((text, index) => ({ id: `s2-${index}`, text })),
  },
  {
    id: "s3",
    tokens: "Elle savait pourtant que le voyage ne faisait que commencer.".split(" ").map((text, index) => ({ id: `s3-${index}`, text })),
  },
  {
    id: "s4",
    tokens: "Au loin, le premier train siffla comme une promesse dans l’obscurité.".split(" ").map((text, index) => ({ id: `s4-${index}`, text })),
  },
];

const SPEEDS = [1, 1.25, 1.5, 2];
const VOICES = ["fr_FR-siwis", "fr_FR-upmc", "fr_FR-gilles"];

export default function ReaderView({
  bookTitle = "Les chemins de traverse",
  chapterTitle = "Chapitre 4 — La promesse",
  onBack,
}: ReaderViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(1);
  const [wordIndex, setWordIndex] = useState(2);
  const [speed, setSpeed] = useState(1);
  const [voice, setVoice] = useState(VOICES[0]);
  const [pitch, setPitch] = useState(0);
  const activeSentenceRef = useRef<HTMLParagraphElement>(null);
  const totalWords = useMemo(() => DEMO_SENTENCES.reduce((sum, sentence) => sum + sentence.tokens.length, 0), []);
  const readWords = DEMO_SENTENCES.slice(0, sentenceIndex).reduce((sum, sentence) => sum + sentence.tokens.length, 0) + wordIndex;
  const progress = Math.round((readWords / totalWords) * 100);

  // Démo : un mot est avancé à intervalle régulier. En production, remplacez
  // cet effet par les timestamps word/phoneme fournis par votre pipeline Piper.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setWordIndex((currentWord) => {
        const sentence = DEMO_SENTENCES[sentenceIndex];
        if (currentWord < sentence.tokens.length - 1) return currentWord + 1;
        if (sentenceIndex < DEMO_SENTENCES.length - 1) {
          setSentenceIndex((currentSentence) => currentSentence + 1);
          return 0;
        }
        setIsPlaying(false);
        return currentWord;
      });
    }, 520 / speed);
    return () => window.clearInterval(timer);
  }, [isPlaying, sentenceIndex, speed]);

  useEffect(() => {
    activeSentenceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sentenceIndex]);

  const jumpTo = (nextSentence: number, nextWord: number) => {
    setSentenceIndex(nextSentence);
    setWordIndex(nextWord);
    setIsPlaying(true);
  };

  return (
    <div className="fixed inset-0 flex min-h-screen flex-col overflow-hidden bg-[#090d16] text-slate-100 selection:bg-violet-400/30">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-40 top-24 h-96 w-96 rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -right-32 bottom-36 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-white/[0.07] bg-[#090d16]/80 px-5 py-4 backdrop-blur-xl sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <button onClick={onBack} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.07] hover:text-white" aria-label="Retour à la bibliothèque">
            <Library className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-violet-300/80">
              <BookOpen className="h-3.5 w-3.5" /> Lecture en cours
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="truncate text-sm font-semibold text-white sm:text-base">{bookTitle}</h1>
              <span className="hidden text-sm text-slate-500 sm:inline">/</span>
              <p className="truncate text-sm text-slate-400">{chapterTitle}</p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-white">Chapitre 4 <span className="text-violet-300">• {progress}%</span></p>
            <div className="mt-2 h-1 w-32 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-sky-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          </div>
        </div>
      </header>

      <main className="relative z-0 flex-1 overflow-y-auto px-5 pb-48 pt-14 sm:px-8 sm:pt-20">
        <article className="mx-auto max-w-3xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Extrait audio synchronisé</p>
            <h2 className="font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">La promesse</h2>
          </div>
          <div className="space-y-8 font-serif text-xl leading-loose text-slate-300 sm:text-[1.45rem]">
            {DEMO_SENTENCES.map((sentence, currentSentence) => {
              const isActive = currentSentence === sentenceIndex;
              const isRead = currentSentence < sentenceIndex;
              return (
                <p
                  key={sentence.id}
                  ref={isActive ? activeSentenceRef : undefined}
                  className={`relative rounded-2xl px-4 py-2 transition-all duration-500 ${isActive ? "bg-gradient-to-r from-violet-500/[0.13] via-sky-400/[0.08] to-transparent text-slate-100 opacity-100 shadow-[0_0_60px_rgba(139,92,246,0.09)] ring-1 ring-violet-300/10" : isRead ? "opacity-60" : "opacity-75"}`}
                >
                  {isActive && <span className="absolute -left-1 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-violet-400 to-sky-400 shadow-[0_0_18px_rgba(167,139,250,0.8)]" />}
                  {sentence.tokens.map((token, currentWord) => {
                    const isCurrentWord = isActive && currentWord === wordIndex;
                    return (
                      <button
                        key={token.id}
                        onClick={() => jumpTo(currentSentence, currentWord)}
                        className={`mr-[0.28em] inline rounded-md px-0.5 text-left transition-all duration-200 hover:bg-violet-300/20 focus:outline-none focus:ring-2 focus:ring-violet-400/60 ${isCurrentWord ? "bg-gradient-to-r from-violet-500 to-sky-500 px-1 text-white shadow-[0_0_22px_rgba(139,92,246,0.55)]" : "hover:text-white"}`}
                        aria-label={`Lire « ${token.text} »`}
                      >{token.text}</button>
                    );
                  })}
                </p>
              );
            })}
          </div>
        </article>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/[0.08] bg-[#0c111d]/95 px-4 pb-5 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-400 to-sky-400 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-1">
              <button onClick={() => jumpTo(sentenceIndex, Math.max(0, wordIndex - 3))} className="rounded-xl p-2.5 text-slate-400 hover:bg-white/[0.07] hover:text-white" aria-label="Reculer de 10 secondes"><RotateCcw className="h-4 w-4" /><span className="sr-only">10</span></button>
              <button onClick={() => setIsPlaying((playing) => !playing)} className="rounded-2xl bg-white p-3 text-slate-950 shadow-lg shadow-violet-500/20 transition hover:scale-105" aria-label={isPlaying ? "Pause" : "Lecture"}>{isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}</button>
              <button onClick={() => jumpTo(Math.min(DEMO_SENTENCES.length - 1, sentenceIndex + 1), 0)} className="rounded-xl p-2.5 text-slate-400 hover:bg-white/[0.07] hover:text-white" aria-label="Avancer de 10 secondes"><RotateCw className="h-4 w-4" /></button>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex"><Gauge className="h-4 w-4" /> {sentenceIndex + 1} / {DEMO_SENTENCES.length} phrases</div>
            <div className="ml-auto flex items-center gap-2">
              <label className="hidden items-center gap-2 text-xs text-slate-400 md:flex"><Volume2 className="h-4 w-4" /><select value={voice} onChange={(event) => setVoice(event.target.value)} className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-xs text-slate-200 outline-none"><option value="fr_FR-siwis">Siwis · FR</option><option value="fr_FR-upmc">UPMC · FR</option><option value="fr_FR-gilles">Gilles · FR</option></select></label>
              <label className="flex items-center gap-2 text-xs text-slate-400"><span className="hidden lg:inline">Vitesse</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1.5 text-xs text-slate-200 outline-none">{SPEEDS.map((value) => <option key={value} value={value}>{value}×</option>)}</select></label>
              <label className="hidden items-center gap-2 text-xs text-slate-400 xl:flex"><SlidersHorizontal className="h-4 w-4" /><input type="range" min="-4" max="4" value={pitch} onChange={(event) => setPitch(Number(event.target.value))} className="accent-violet-400" /><span className="w-8">{pitch > 0 ? `+${pitch}` : pitch}</span></label>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1 text-[11px] text-slate-500 sm:hidden"><Sparkles className="h-3 w-3 text-violet-300" /> {voice} · tonalité {pitch > 0 ? `+${pitch}` : pitch}</div>
        </div>
      </footer>
    </div>
  );
}
