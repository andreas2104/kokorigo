"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import EpubReader from "@/components/EpubReader";
import EpubReaderWithTTS from "@/components/EpubReaderWithTTS";
import { downloadBook } from "@/hooks/useBooks";

function ReaderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const book = searchParams.get("book");
  const format = searchParams.get("format") === "pdf" ? "pdf" : "epub";
  const bookIdValue = searchParams.get("bookId");
  const bookId = bookIdValue && /^\d+$/.test(bookIdValue) ? Number(bookIdValue) : null;
  const bookTitle = searchParams.get("title")?.trim() || "Livre";
  const [libraryFile, setLibraryFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (bookId === null) return;
    let cancelled = false;
    setLibraryFile(null);
    setLoadError(null);
    void downloadBook(bookId)
      .then((downloaded) => {
        if (cancelled) return;
        const fileName = bookTitle.toLocaleLowerCase().endsWith(".epub") ? bookTitle : `${bookTitle}.epub`;
        setLibraryFile(new File([downloaded], fileName, { type: downloaded.type }));
      })
      .catch((reason) => {
        if (!cancelled) setLoadError(reason instanceof Error ? reason.message : "Impossible d’ouvrir ce livre.");
      });
    return () => {
      cancelled = true;
    };
  }, [bookId, bookTitle]);

  if (bookId !== null) {
    if (loadError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900 px-6 text-center text-slate-200">
          <p>{loadError}</p>
          <button type="button" onClick={() => router.push("/")} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Retour à la bibliothèque</button>
        </div>
      );
    }
    if (!libraryFile) {
      return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">Ouverture du livre…</div>;
    }
    return <EpubReaderWithTTS file={libraryFile} onClose={() => router.push("/")} />;
  }

  if (!book) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900">
        <p className="text-slate-300">Aucun livre sélectionné.</p>
        <a
          href="/"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Choisir un EPUB
        </a>
      </div>
    );
  }

  return (
    <EpubReader
      url={book}
      format={format}
      onClose={() => router.push("/")}
    />
  );
}

export default function ReaderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
          Ouverture du livre…
        </div>
      }
    >
      <ReaderContent />
    </Suspense>
  );
}
