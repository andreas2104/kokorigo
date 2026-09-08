"use client";

import { useState } from "react";
import { ReactReader } from "react-reader";

type EpubReaderProps = {
  url: string;
  format: "epub" | "pdf";
  onClose: () => void;
};

export default function EpubReader({ url, format, onClose }: EpubReaderProps) {
  const [location, setLocation] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900">
      <header className="flex items-center justify-between gap-4 border-b border-slate-700 bg-slate-900 px-4 py-3">
        <h1 className="truncate text-sm font-medium text-slate-200 sm:text-base">
          Lecteur EPUB
        </h1>
        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          Fermer
        </button>
      </header>

      <div className="flex-1 overflow-hidden bg-slate-100">
        {format === "pdf" ? (
          <iframe src={url} title="Livre PDF" className="h-full w-full border-0" />
        ) : (
          <ReactReader
            url={url}
            title="Livre EPUB"
            showToc
            epubInitOptions={{ openAs: "epub" }}
            location={location}
            locationChanged={(epubcfi) => setLocation(epubcfi)}
          />
        )}
      </div>
    </div>
  );
}
