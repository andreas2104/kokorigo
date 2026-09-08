"use client";

import { useState } from "react";
import { storedBookUrl, type BookItem } from "@/types/book";

type DownloadCardProps = {
  book: BookItem;
};

export default function DownloadCard({ book }: DownloadCardProps) {
  const [coverError, setCoverError] = useState(false);
  const format = book.format ?? "epub";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100">
        {!coverError && book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt={`Couverture de ${book.title}`}
            className="h-full w-full object-cover"
            onError={() => setCoverError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-100 to-purple-100 p-4">
            <span className="line-clamp-6 text-center text-lg font-semibold text-indigo-800">
              {book.title}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-base font-semibold text-slate-900">
          {book.title}
        </h3>
        <p className="line-clamp-1 text-sm text-slate-500">{book.author}</p>
        <div className="mt-3 flex flex-col gap-2">
          <a
            href={storedBookUrl(book.id)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 10-1.09-1.03l-2.955 3.129V2.75z" />
              <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
            </svg>
            Télécharger
          </a>
          <a
            href={`/reader?book=${encodeURIComponent(storedBookUrl(book.id))}&format=${format}`}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Lire ({format.toUpperCase()})
          </a>
        </div>
      </div>
    </div>
  );
}
