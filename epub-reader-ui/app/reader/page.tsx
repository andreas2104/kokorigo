"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import EpubReader from "@/components/EpubReader";

function ReaderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const book = searchParams.get("book");
  const format = searchParams.get("format") === "pdf" ? "pdf" : "epub";

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
