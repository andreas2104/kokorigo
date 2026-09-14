"use client";

import {
  AlertCircle,
  AudioLines,
  BookOpen,
  ChevronDown,
  Download,
  Gauge,
  Headphones,
  Library,
  Lightbulb,
  Loader2,
  Moon,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Volume2,
  WifiOff,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import EpubReaderWithTTS from "@/components/EpubReaderWithTTS";
import OfflineVoiceCard from "@/components/OfflineVoiceCard";
import { requestTtsAudio } from "@/hooks/useAudioTTS";
import { useBackendStatus } from "@/hooks/useBackendStatus";
import { downloadBook, useBooks, useLibraryActions } from "@/hooks/useBooks";
import { useVoices } from "@/hooks/useVoices";
import { isDeviceVoice, speakWithDevice } from "@/lib/device-speech";
import { isLocalPiperVoice } from "@/lib/piper-local";
import { tokenizeText } from "@/lib/word-timing";
import type { BookItem } from "@/types/book";
import { engineLabel } from "@/types/voice";

const speeds = [0.8, 1, 1.2, 1.5];

function initials(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export default function WorkspaceReader() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const readerSectionRef = useRef<HTMLDivElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewStopRef = useRef<(() => void) | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busyBookId, setBusyBookId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState("piper:ff_siwis");
  const [speed, setSpeed] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const booksQuery = useBooks();
  const voicesQuery = useVoices();
  const { status: backendStatus } = useBackendStatus();
  const { upload, remove } = useLibraryActions();

  const voices = voicesQuery.data?.filter((voice) => voice.available) ?? [];
  const selectedVoice = voices.find((voice) => voice.id === voiceId) ?? voices[0];
  const books = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("fr");
    return (booksQuery.data ?? []).filter((book) =>
      !value || `${book.title} ${book.author}`.toLocaleLowerCase("fr").includes(value),
    );
  }, [booksQuery.data, query]);

  useEffect(() => {
    if (selectedVoice && !voices.some((voice) => voice.id === voiceId)) setVoiceId(selectedVoice.id);
  }, [selectedVoice, voiceId, voices]);

  useEffect(() => () => {
    previewAudioRef.current?.pause();
    previewStopRef.current?.();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("kokorigo:theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDarkTheme = savedTheme ? savedTheme === "dark" : prefersDark;
    setIsDarkMode(useDarkTheme);
    document.documentElement.classList.toggle("dark", useDarkTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem("kokorigo:theme", nextTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", nextTheme);
  };

  const openPicker = () => inputRef.current?.click();

  const importFile = async (candidate?: File) => {
    if (!candidate) return;
    if (!candidate.name.toLocaleLowerCase().endsWith(".epub")) {
      setError("Sélectionnez un fichier EPUB (.epub).");
      return;
    }
    setError(null);
    setFile(candidate);
    try {
      await upload(candidate);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer cet EPUB.");
    }
  };

  const openBook = async (book: BookItem) => {
    setBusyBookId(book.id);
    setError(null);
    try {
      const downloaded = await downloadBook(book);
      setFile(new File([downloaded], `${book.title}.epub`, { type: downloaded.type }));
      setLibraryOpen(false);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          readerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’ouvrir ce livre.");
    } finally {
      setBusyBookId(null);
    }
  };

  const deleteBook = async (book: BookItem) => {
    setBusyBookId(book.id);
    setError(null);
    try {
      await remove(book);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de supprimer ce livre.");
    } finally {
      setBusyBookId(null);
    }
  };

  const testVoice = async () => {
    if (!selectedVoice || previewing) return;
    setPreviewing(true);
    setError(null);
    previewAudioRef.current?.pause();
    previewStopRef.current?.();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const sample = `Bonjour. Je suis ${selectedVoice.name}, la voix choisie pour lire votre livre.`;

    if (isDeviceVoice(selectedVoice.id)) {
      previewStopRef.current = speakWithDevice({
        text: sample,
        tokens: tokenizeText(sample),
        voiceId: selectedVoice.id,
        rate: speed,
        onWordIndex: () => undefined,
        onEnd: () => setPreviewing(false),
        onError: (message) => {
          setError(message);
          setPreviewing(false);
        },
      });
      return;
    }

    try {
      const url = await requestTtsAudio(sample, { voice: selectedVoice.id, speed });
      previewUrlRef.current = url;
      const audio = new Audio(url);
      // La voix embarquée ignore le paramètre de vitesse : on l'applique ici.
      if (isLocalPiperVoice(selectedVoice.id)) audio.playbackRate = speed;
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewing(false);
      await audio.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’extrait vocal est indisponible.");
      setPreviewing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf8f4] text-[#111d35] transition-colors dark:bg-[#080d18] dark:text-slate-100">
      <input ref={inputRef} type="file" accept=".epub,application/epub+zip" aria-label="Choisir un fichier EPUB" className="sr-only" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />

      <header className="sticky top-0 z-30 border-b border-[#eee4d8] bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-[#0b1120]/95">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-4 lg:px-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#e18b05] to-[#b65800] text-white shadow-sm sm:h-11 sm:w-11"><BookOpen className="h-5 w-5 sm:h-6 sm:w-6" /></span>
          <div className="min-w-0"><p className="truncate text-base font-bold leading-5 sm:text-lg">Kokorigo</p><p className="truncate text-[11px] text-[#768096] dark:text-slate-400 sm:text-xs">Bibliothèque EPUB</p></div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {backendStatus === "offline" && <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 sm:h-10 sm:px-3" title="Mode hors ligne : bibliothèque locale et voix de l’appareil"><WifiOff className="h-4 w-4" /><span className="hidden sm:inline">Hors ligne</span></span>}
            <button type="button" onClick={toggleTheme} className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#f0d8bb] bg-[#fffaf2] text-sm font-medium text-[#9a5200] transition hover:bg-[#fff3df] dark:border-slate-700 dark:bg-slate-800 dark:text-amber-200 dark:hover:bg-slate-700 sm:w-auto sm:px-3" aria-label={isDarkMode ? "Activer le mode jour" : "Activer le mode nuit"} title={isDarkMode ? "Mode jour" : "Mode nuit"}>{isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span className="hidden sm:inline">{isDarkMode ? "Mode jour" : "Mode nuit"}</span></button>
            <button type="button" onClick={openPicker} aria-label="Importer un EPUB" className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#d77c00] to-[#b45b00] text-sm font-semibold text-white shadow-[0_5px_14px_rgba(181,90,0,.18)] sm:h-11 sm:w-auto sm:px-4"><Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importer un EPUB</span></button>
          </div>
        </div>
      </header>

      {error && <div role="alert" className="mx-3 mt-4 flex max-w-[1460px] items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200 sm:mx-4 lg:mx-auto"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <div className="mx-auto grid max-w-[1500px] items-start gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:p-5">
        <aside className="order-2 flex flex-col rounded-2xl border border-[#e9e1d7] bg-white p-3 shadow-[0_8px_30px_rgba(59,40,12,.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-3.5 lg:order-1 lg:min-h-[720px]">
          <div className="flex items-start gap-2 px-1 py-2">
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-3 text-lg font-bold sm:text-xl"><Library className="h-5 w-5 shrink-0 text-[#c66600]" /> Bibliothèque</h1>
              <p className="mt-1 text-sm text-[#768096] dark:text-slate-400">Vos livres importés · {booksQuery.data?.length ?? 0}</p>
            </div>
            <button type="button" onClick={() => setLibraryOpen((value) => !value)} aria-expanded={libraryOpen} aria-controls="library-panel" className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#768096] hover:bg-[#f7f2ea] dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden">
              <ChevronDown className={`h-5 w-5 transition-transform ${libraryOpen ? "rotate-180" : ""}`} />
              <span className="sr-only">{libraryOpen ? "Masquer la bibliothèque" : "Afficher la bibliothèque"}</span>
            </button>
          </div>
          <div id="library-panel" className={`min-h-0 flex-1 flex-col ${libraryOpen ? "flex" : "hidden"} lg:flex`}>
            <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-[#e6e2dc] bg-[#fcfbf9] px-3 text-[#89909d] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500"><Search className="h-4 w-4 shrink-0" /><span className="sr-only">Rechercher un livre</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-base text-[#172038] outline-none dark:text-slate-100 sm:text-sm" placeholder="Rechercher un livre…" /></label>
            <div className="mt-4 flex max-h-[60vh] min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:max-h-[545px]">
              {booksQuery.isLoading && <div className="flex flex-1 items-center justify-center gap-2 py-6 text-sm text-[#768096] dark:text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>}
              {booksQuery.isError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/60 dark:text-red-200">Bibliothèque inaccessible.</p>}
              {!booksQuery.isLoading && !booksQuery.isError && !books.length && <div className="grid flex-1 place-items-center px-4 py-8 text-center text-sm leading-6 text-[#768096] dark:text-slate-400">{query ? "Aucun résultat." : "Aucun livre importé."}</div>}
              {books.map((book, index) => (
                <div key={book.id} className="group flex gap-3 rounded-xl border border-[#ece7df] bg-white p-2 transition hover:border-[#e9c895] hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-amber-700">
                  <button type="button" onClick={() => void openBook(book)} disabled={busyBookId !== null} className="flex min-w-0 flex-1 gap-3 text-left disabled:cursor-wait">
                    <span className={`grid h-[76px] w-[55px] shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-bold ${index % 3 === 0 ? "bg-[#dae4e8] text-[#345268]" : index % 3 === 1 ? "bg-[#efe0ce] text-[#70491f]" : "bg-[#dce8df] text-[#24523e]"}`}>
                      {book.coverUrl ? <img src={book.coverUrl} alt="" className="h-full w-full object-cover" /> : initials(book.title)}
                    </span>
                    <span className="min-w-0 py-1"><strong className="line-clamp-2 text-sm leading-5">{book.title}</strong><span className="mt-1 block truncate text-xs text-[#768096] dark:text-slate-400">{book.author || "Auteur non renseigné"}</span><span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium"><span className="flex items-center gap-1 text-[#b65b00] dark:text-amber-400">{busyBookId === book.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />} Lire</span>{book.offline && <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400" title="Copie enregistrée sur cet appareil"><Download className="h-3 w-3" /> Hors ligne</span>}</span></span>
                  </button>
                  <button type="button" onClick={() => void deleteBook(book)} disabled={busyBookId !== null} className="self-start rounded-md p-2 text-[#778093] hover:bg-red-50 hover:text-red-700 lg:p-1 lg:opacity-30 lg:group-hover:opacity-100" aria-label={`Supprimer ${book.title}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-[#eee5d8] bg-[#fffdf9] p-3 dark:border-slate-800 dark:bg-slate-950"><p className="flex items-center gap-2 text-sm font-semibold"><Library className="h-4 w-4 text-[#c66600]" />{booksQuery.data?.length ?? 0} livre(s)</p><button onClick={openPicker} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#c76800] text-sm font-semibold text-white"><Upload className="h-4 w-4" /> Importer un EPUB</button></div>
          </div>
        </aside>

        {file ? (
          <div ref={readerSectionRef} className="order-1 min-w-0 scroll-mt-20 lg:order-2 lg:scroll-mt-24">
            <EpubReaderWithTTS file={file} onClose={() => { setFile(null); void booksQuery.refetch(); }} embedded voiceId={selectedVoice?.id ?? voiceId} onVoiceChange={setVoiceId} playbackSpeed={speed} onPlaybackSpeedChange={setSpeed} />
          </div>
        ) : (
          <section onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void importFile(event.dataTransfer.files?.[0]); }} className={`order-1 grid min-h-[24rem] place-items-center rounded-2xl border-2 border-dashed bg-white px-4 py-10 text-center shadow-[0_8px_30px_rgba(59,40,12,.04)] transition dark:bg-slate-900 sm:px-6 lg:order-2 lg:min-h-[720px] ${dragging ? "border-[#c96b00] bg-[#fff9ef] dark:bg-amber-950/20" : "border-[#ecc995] dark:border-slate-700"}`}>
            <div className="max-w-xl">
              <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#fff3df] text-[#c56500] sm:h-28 sm:w-28"><BookOpen className="h-10 w-10 sm:h-14 sm:w-14" strokeWidth={1.4} /></span>
              <h2 className="mt-6 text-2xl font-bold tracking-tight sm:mt-7 sm:text-3xl">Glissez votre fichier EPUB ici</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#768096] dark:text-slate-400 sm:text-base sm:leading-7">Ou parcourez vos dossiers. Le livre est enregistré dans votre bibliothèque locale puis ouvert dans ce lecteur.</p>
              <button type="button" onClick={openPicker} className="mt-6 inline-flex items-center gap-3 rounded-xl bg-gradient-to-b from-[#da7d00] to-[#b65b00] px-6 py-3.5 font-semibold text-white shadow-[0_6px_18px_rgba(181,90,0,.2)] sm:mt-7 sm:px-8"><Upload className="h-5 w-5" /> Parcourir mes fichiers</button>
              <div className="mt-8 flex flex-wrap justify-center gap-2 text-xs sm:gap-3 sm:text-sm"><span className="flex items-center gap-2 rounded-full border border-[#e9e1d7] px-3 py-2 text-[#59647a] dark:border-slate-700 dark:text-slate-300 sm:px-4"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" /> Traitement local</span><span className="flex items-center gap-2 rounded-full border border-[#e9e1d7] px-3 py-2 text-[#59647a] dark:border-slate-700 dark:text-slate-300 sm:px-4"><Headphones className="h-4 w-4 shrink-0 text-[#c56500]" /> Piper + Kokoro + F5-TTS</span></div>
            </div>
          </section>
        )}

        <aside className="order-3 rounded-2xl border border-[#e9e1d7] bg-white p-3 shadow-[0_8px_30px_rgba(59,40,12,.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-3.5 lg:min-h-[720px]">
          <div className="flex items-start gap-2 px-1 py-2">
            <div className="min-w-0 flex-1"><h2 className="flex items-center gap-3 text-lg font-bold sm:text-xl"><AudioLines className="h-5 w-5 shrink-0 text-[#c66600]" /> Lecture vocale</h2><p className="mt-1 text-sm text-[#768096] dark:text-slate-400">Voix et rythme de lecture</p></div>
            <button type="button" onClick={() => setVoicePanelOpen((value) => !value)} aria-expanded={voicePanelOpen} aria-controls="voice-panel" className="-mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#768096] hover:bg-[#f7f2ea] dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden">
              <ChevronDown className={`h-5 w-5 transition-transform ${voicePanelOpen ? "rotate-180" : ""}`} />
              <span className="sr-only">{voicePanelOpen ? "Masquer les réglages vocaux" : "Afficher les réglages vocaux"}</span>
            </button>
          </div>

          <div id="voice-panel" className={`${voicePanelOpen ? "block" : "hidden"} lg:block`}>
            <section className="mt-4 rounded-xl border border-[#ece5dc] p-3 dark:border-slate-800"><p className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="h-4 w-4 text-[#c66600]" /> Voix sélectionnée</p><label className="relative mt-3 block"><span className="sr-only">Voix</span><select value={selectedVoice?.id ?? ""} onChange={(event) => setVoiceId(event.target.value)} disabled={voicesQuery.isLoading || !voices.length} className="h-14 w-full appearance-none rounded-xl border border-[#e8e2da] bg-[#fffdfa] px-3 pr-9 text-base font-semibold outline-none focus:border-[#d27a0b] dark:border-slate-700 dark:bg-slate-950 sm:text-sm"><option value="">{voicesQuery.isLoading ? "Chargement des voix…" : "Aucune voix disponible"}</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {engineLabel(voice.engine)}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-[#778093]" /></label>{selectedVoice && <p className="mt-2 text-xs text-[#768096] dark:text-slate-400">{selectedVoice.language} · {selectedVoice.character || "Voix naturelle"}</p>}{!voicesQuery.isLoading && !voices.length && <p className="mt-2 text-xs leading-5 text-[#9a5000] dark:text-amber-300">Aucune voix sur cet appareil. Installez une voix française dans les réglages du téléphone : Android ‹ Paramètres ‹ Accessibilité ‹ Synthèse vocale ; iPhone ‹ Réglages ‹ Accessibilité ‹ Contenu énoncé ‹ Voix.</p>}</section>

            <OfflineVoiceCard />

            <section className="mt-3 rounded-xl border border-[#ece5dc] p-3 dark:border-slate-800"><p className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-[#c66600]" /> Vitesse de lecture</p><p className="mt-3 text-sm">{speed.toFixed(1)}× {speed === 1 ? "(Normale)" : ""}</p><input type="range" min="0.8" max="1.5" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="mt-3 w-full accent-[#c66600]" /><div className="flex justify-between text-xs text-[#8a91a0] dark:text-slate-500"><span>Plus lent</span><span>Plus rapide</span></div><div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-1">{speeds.map((value) => <button key={value} onClick={() => setSpeed(value)} className={`rounded-lg py-2.5 text-sm sm:py-1.5 sm:text-xs ${speed === value ? "bg-[#fff0d9] font-semibold text-[#a65000] dark:bg-amber-950 dark:text-amber-300" : "bg-[#f7f5f2] text-[#687185] dark:bg-slate-800 dark:text-slate-300"}`}>{value}×</button>)}</div></section>

            <button type="button" onClick={() => void testVoice()} disabled={!selectedVoice || previewing} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#db8000] to-[#b65b00] text-sm font-semibold text-white shadow-sm disabled:opacity-50">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} Tester la voix</button>

            <section className="mt-5 rounded-xl border border-[#f0dfc7] bg-[#fff9ef] p-4 dark:border-amber-900/60 dark:bg-amber-950/20"><p className="flex items-center gap-2 font-semibold text-[#9a5000] dark:text-amber-300"><Lightbulb className="h-5 w-5" /> Conseil</p><p className="mt-2 text-sm leading-6 text-[#6e7480] dark:text-slate-400">Vous pouvez changer de voix et de vitesse à tout moment, même pendant la lecture. Sur mobile, appuyez longuement sur le texte pour régler la taille et la police.</p></section>
          </div>
        </aside>
      </div>
    </main>
  );
}
