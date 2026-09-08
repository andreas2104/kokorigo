"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import DropZone from "@/components/DropZone";
import EpubReaderWithTTS from "@/components/EpubReaderWithTTS";
import LibrarySection from "@/components/LibrarySection";
import MiniPlayer from "@/components/MiniPlayer";
import SettingsDialog from "@/components/SettingsDialog";
import { useBooks, useLibraryActions } from "@/hooks/useBooks";
import { storedBookUrl, type BookItem } from "@/types/book";

const MOCK_BOOKS: BookItem[] = [
  {
    id: -1,
    title: "Les Misérables",
    author: "Victor Hugo",
    coverUrl: "",
    fileName: "les-miserables.epub",
    addedAt: new Date().toISOString(),
    progress: { chapter: 4, totalChapters: 12, percent: 45 },
  },
  {
    id: -2,
    title: "Dune",
    author: "Frank Herbert",
    coverUrl: "",
    fileName: "dune.epub",
    addedAt: new Date().toISOString(),
    progress: { chapter: 2, totalChapters: 22, percent: 18 },
  },
  {
    id: -3,
    title: "Le Petit Prince",
    author: "Antoine de Saint-Exupéry",
    coverUrl: "",
    fileName: "le-petit-prince.epub",
    addedAt: new Date().toISOString(),
    progress: { chapter: 7, totalChapters: 27, percent: 40 },
  },
  {
    id: -4,
    title: "Vingt mille lieues sous les mers",
    author: "Jules Verne",
    coverUrl: "",
    fileName: "vingt-mille-lieues.epub",
    addedAt: new Date().toISOString(),
    progress: { chapter: 9, totalChapters: 20, percent: 70 },
  },
];

function storedProgress(id: number): BookItem["progress"] {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(`kokorigo:progress:${id}`);
    return raw ? (JSON.parse(raw) as BookItem["progress"]) : undefined;
  } catch {
    return undefined;
  }
}

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playing, setPlaying] = useState<BookItem | null>(null);

  const booksQuery = useBooks();
  const { upload, remove } = useLibraryActions();

  const books = useMemo(() => {
    const source = booksQuery.data?.length ? booksQuery.data : MOCK_BOOKS;
    return source
      .filter((book) => !removedIds.includes(book.id))
      .map((book) =>
        book.progress ? book : { ...book, progress: storedProgress(book.id) },
      );
  }, [booksQuery.data, removedIds]);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFile = (candidate?: File) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".epub")) {
      setError("Sélectionnez un fichier EPUB (.epub).");
      return;
    }
    setError(null);
    setFile(candidate);
    void upload(candidate).catch(() => {
      // Le backend peut être indisponible : la lecture locale fonctionne quand même.
    });
  };

  const handleResume = (book: BookItem) => {
    if (book.id >= 0) {
      router.push(`/reader?book=${encodeURIComponent(storedBookUrl(book.id))}&format=${book.format ?? "epub"}`);
      return;
    }
    setPlaying(book);
  };

  const handleListen = (book: BookItem) => setPlaying(book);

  const handleDelete = (book: BookItem) => {
    setRemovedIds((ids) => [...ids, book.id]);
    if (book.id >= 0) {
      void remove(book.id).catch(() => {
        // Si le backend répond mal, le livre réapparaît au prochain rafraîchissement.
      });
    }
  };

  if (file) {
    return <EpubReaderWithTTS file={file} onClose={() => setFile(null)} />;
  }

  return (
    <div className="relative isolate min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] overflow-hidden">
        <div className="absolute left-1/2 top-2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/25 via-accent/15 to-transparent blur-3xl" />
        <div className="absolute -right-24 top-48 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -left-24 top-80 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".epub,application/epub+zip"
        aria-label="Choisir un fichier EPUB"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <AppHeader
        onImport={openFilePicker}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="mx-auto max-w-7xl px-4 pb-32 pt-10 sm:px-6 lg:px-8">
        <DropZone onFile={handleFile} onBrowse={openFilePicker} error={error} />

        <LibrarySection
          books={books}
          isLoading={booksQuery.isLoading}
          onBrowse={openFilePicker}
          onListen={handleListen}
          onResume={handleResume}
          onDelete={handleDelete}
        />
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        Kokorigo · Stockage local · Synthèse vocale Piper TTS
      </footer>

      {playing && <MiniPlayer book={playing} onClose={() => setPlaying(null)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}