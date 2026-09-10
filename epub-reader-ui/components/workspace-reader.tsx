"use client";

import {
  AlertCircle,
  AudioLines,
  BookOpen,
  ChevronDown,
  Gauge,
  Headphones,
  Library,
  Lightbulb,
  Loader2,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  Volume2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import EpubReaderWithTTS from "@/components/EpubReaderWithTTS";
import { requestTtsAudio } from "@/hooks/useAudioTTS";
import { downloadBook, useBooks, useLibraryActions } from "@/hooks/useBooks";
import { useVoices } from "@/hooks/useVoices";
import type { BookItem } from "@/types/book";

const speeds = [0.8, 1, 1.2, 1.5];

function initials(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
}

export default function WorkspaceReader() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busyBookId, setBusyBookId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceId, setVoiceId] = useState("piper:ff_siwis");
  const [speed, setSpeed] = useState(1);
  const [previewing, setPreviewing] = useState(false);
  const booksQuery = useBooks();
  const voicesQuery = useVoices();
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
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

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
      const downloaded = await downloadBook(book.id);
      setFile(new File([downloaded], `${book.title}.epub`, { type: downloaded.type }));
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
      await remove(book.id);
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
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    try {
      const url = await requestTtsAudio(
        `Bonjour. Je suis ${selectedVoice.name}, la voix choisie pour lire votre livre.`,
        { voice: selectedVoice.id, speed },
      );
      previewUrlRef.current = url;
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewing(false);
      await audio.play();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "L’extrait vocal est indisponible.");
      setPreviewing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf8f4] text-[#111d35]">
      <input ref={inputRef} type="file" accept=".epub,application/epub+zip" aria-label="Choisir un fichier EPUB" className="sr-only" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ""; }} />

      <header className="sticky top-0 z-30 border-b border-[#eee4d8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-3 px-4 lg:px-6">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#e18b05] to-[#b65800] text-white shadow-sm"><BookOpen className="h-6 w-6" /></span>
          <div><p className="text-lg font-bold leading-5">Kokorigo</p><p className="text-xs text-[#768096]">Bibliothèque EPUB</p></div>
          <span className="ml-auto hidden items-center gap-2 rounded-full border border-[#f0d8bb] bg-[#fffaf2] px-4 py-2 text-sm font-medium text-[#9a5200] sm:flex"><span className="h-2.5 w-2.5 rounded-full bg-[#d88706] shadow-[0_0_0_4px_#faead1]" /> Mode local</span>
          <button type="button" onClick={openPicker} className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-b from-[#d77c00] to-[#b45b00] px-4 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(181,90,0,.18)]"><Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importer un EPUB</span></button>
        </div>
      </header>

      {error && <div role="alert" className="mx-auto mt-4 flex max-w-[1460px] items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      <div className="mx-auto grid max-w-[1500px] items-start gap-4 p-4 lg:grid-cols-[280px_minmax(0,1fr)_300px] lg:p-5">
        <aside className="flex min-h-[720px] flex-col rounded-2xl border border-[#e9e1d7] bg-white p-3.5 shadow-[0_8px_30px_rgba(59,40,12,.04)]">
          <div className="px-1 py-2">
            <h1 className="flex items-center gap-3 text-xl font-bold"><Library className="h-5 w-5 text-[#c66600]" /> Bibliothèque</h1>
            <p className="mt-1 text-sm text-[#768096]">Vos livres importés · {booksQuery.data?.length ?? 0}</p>
          </div>
          <label className="mt-3 flex h-11 items-center gap-2 rounded-xl border border-[#e6e2dc] bg-[#fcfbf9] px-3 text-[#89909d]"><Search className="h-4 w-4" /><span className="sr-only">Rechercher un livre</span><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#172038] outline-none" placeholder="Rechercher un livre…" /></label>
          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:max-h-[545px]">
            {booksQuery.isLoading && <div className="flex flex-1 items-center justify-center gap-2 text-sm text-[#768096]"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>}
            {booksQuery.isError && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Bibliothèque inaccessible.</p>}
            {!booksQuery.isLoading && !booksQuery.isError && !books.length && <div className="grid flex-1 place-items-center px-4 text-center text-sm leading-6 text-[#768096]">{query ? "Aucun résultat." : "Aucun livre importé."}</div>}
            {books.map((book, index) => (
              <div key={book.id} className="group flex gap-3 rounded-xl border border-[#ece7df] bg-white p-2 transition hover:border-[#e9c895] hover:shadow-sm">
                <button type="button" onClick={() => void openBook(book)} disabled={busyBookId !== null} className="flex min-w-0 flex-1 gap-3 text-left disabled:cursor-wait">
                  <span className={`grid h-[76px] w-[55px] shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-bold ${index % 3 === 0 ? "bg-[#dae4e8] text-[#345268]" : index % 3 === 1 ? "bg-[#efe0ce] text-[#70491f]" : "bg-[#dce8df] text-[#24523e]"}`}>
                    {book.coverUrl ? <img src={book.coverUrl} alt="" className="h-full w-full object-cover" /> : initials(book.title)}
                  </span>
                  <span className="min-w-0 py-1"><strong className="line-clamp-2 text-sm leading-5">{book.title}</strong><span className="mt-1 block truncate text-xs text-[#768096]">{book.author || "Auteur non renseigné"}</span><span className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#b65b00]">{busyBookId === book.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />} Lire</span></span>
                </button>
                <button type="button" onClick={() => void deleteBook(book)} disabled={busyBookId !== null} className="self-start rounded-md p-1 text-[#778093] opacity-30 hover:bg-red-50 hover:text-red-700 group-hover:opacity-100" aria-label={`Supprimer ${book.title}`}><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-[#eee5d8] bg-[#fffdf9] p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Library className="h-4 w-4 text-[#c66600]" />{booksQuery.data?.length ?? 0} livre(s)</p><button onClick={openPicker} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#c76800] text-sm font-semibold text-white"><Upload className="h-4 w-4" /> Importer un EPUB</button></div>
        </aside>

        {file ? (
          <EpubReaderWithTTS file={file} onClose={() => { setFile(null); void booksQuery.refetch(); }} embedded voiceId={selectedVoice?.id ?? voiceId} onVoiceChange={setVoiceId} playbackSpeed={speed} onPlaybackSpeedChange={setSpeed} />
        ) : (
          <section onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void importFile(event.dataTransfer.files?.[0]); }} className={`grid min-h-[720px] place-items-center rounded-2xl border-2 border-dashed bg-white px-6 text-center shadow-[0_8px_30px_rgba(59,40,12,.04)] transition ${dragging ? "border-[#c96b00] bg-[#fff9ef]" : "border-[#ecc995]"}`}>
            <div className="max-w-xl">
              <span className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#fff3df] text-[#c56500]"><BookOpen className="h-14 w-14" strokeWidth={1.4} /></span>
              <h2 className="mt-7 text-3xl font-bold tracking-tight">Glissez votre fichier EPUB ici</h2>
              <p className="mx-auto mt-3 max-w-lg leading-7 text-[#768096]">Ou parcourez vos dossiers. Le livre est enregistré dans votre bibliothèque locale puis ouvert dans ce lecteur.</p>
              <button type="button" onClick={openPicker} className="mt-7 inline-flex h-13 items-center gap-3 rounded-xl bg-gradient-to-b from-[#da7d00] to-[#b65b00] px-8 py-3.5 font-semibold text-white shadow-[0_6px_18px_rgba(181,90,0,.2)]"><Upload className="h-5 w-5" /> Parcourir mes fichiers</button>
              <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm"><span className="flex items-center gap-2 rounded-full border border-[#e9e1d7] px-4 py-2 text-[#59647a]"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Traitement local</span><span className="flex items-center gap-2 rounded-full border border-[#e9e1d7] px-4 py-2 text-[#59647a]"><Headphones className="h-4 w-4 text-[#c56500]" /> Piper + Kokoro</span></div>
            </div>
          </section>
        )}

        <aside className="min-h-[720px] rounded-2xl border border-[#e9e1d7] bg-white p-3.5 shadow-[0_8px_30px_rgba(59,40,12,.04)]">
          <div className="px-1 py-2"><h2 className="flex items-center gap-3 text-xl font-bold"><AudioLines className="h-5 w-5 text-[#c66600]" /> Lecture vocale</h2><p className="mt-1 text-sm text-[#768096]">Voix et rythme de lecture</p></div>

          <section className="mt-4 rounded-xl border border-[#ece5dc] p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Volume2 className="h-4 w-4 text-[#c66600]" /> Voix sélectionnée</p><label className="relative mt-3 block"><span className="sr-only">Voix</span><select value={selectedVoice?.id ?? ""} onChange={(event) => setVoiceId(event.target.value)} disabled={voicesQuery.isLoading || !voices.length} className="h-14 w-full appearance-none rounded-xl border border-[#e8e2da] bg-[#fffdfa] px-3 pr-9 text-sm font-semibold outline-none focus:border-[#d27a0b]"><option value="">{voicesQuery.isLoading ? "Chargement des voix…" : "Aucune voix disponible"}</option>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name} · {voice.engine}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-5 h-4 w-4 text-[#778093]" /></label>{selectedVoice && <p className="mt-2 text-xs text-[#768096]">{selectedVoice.language} · {selectedVoice.character || "Voix naturelle"}</p>}</section>

          <section className="mt-3 rounded-xl border border-[#ece5dc] p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-[#c66600]" /> Vitesse de lecture</p><p className="mt-3 text-sm">{speed.toFixed(1)}× {speed === 1 ? "(Normale)" : ""}</p><input type="range" min="0.8" max="1.5" step="0.1" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} className="mt-3 w-full accent-[#c66600]" /><div className="flex justify-between text-xs text-[#8a91a0]"><span>Plus lent</span><span>Plus rapide</span></div><div className="mt-3 grid grid-cols-4 gap-1">{speeds.map((value) => <button key={value} onClick={() => setSpeed(value)} className={`rounded-lg py-1.5 text-xs ${speed === value ? "bg-[#fff0d9] font-semibold text-[#a65000]" : "bg-[#f7f5f2] text-[#687185]"}`}>{value}×</button>)}</div></section>

          <button type="button" onClick={() => void testVoice()} disabled={!selectedVoice || previewing} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#db8000] to-[#b65b00] text-sm font-semibold text-white shadow-sm disabled:opacity-50">{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />} Tester la voix</button>

          <section className="mt-5 rounded-xl border border-[#f0dfc7] bg-[#fff9ef] p-4"><p className="flex items-center gap-2 font-semibold text-[#9a5000]"><Lightbulb className="h-5 w-5" /> Conseil</p><p className="mt-2 text-sm leading-6 text-[#6e7480]">Vous pouvez changer de voix et de vitesse à tout moment, même pendant la lecture.</p></section>
        </aside>
      </div>
    </main>
  );
}
