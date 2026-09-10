"use client";

import { Headphones, Trash2 } from "lucide-react";
import { useState } from "react";
import type { BookItem } from "@/types/book";
import { cn } from "@/lib/utils";

type Props = {
  book: BookItem;
  index: number;
  onListen: (book: BookItem) => void;
  onResume: (book: BookItem) => void;
  onDelete: (book: BookItem) => void;
};

const COVER_GRADIENTS = [
  "from-indigo-500 via-indigo-400 to-violet-500",
  "from-violet-500 via-purple-400 to-fuchsia-500",
  "from-sky-500 via-cyan-400 to-teal-500",
  "from-rose-500 via-pink-400 to-orange-400",
  "from-emerald-500 via-teal-400 to-cyan-500",
];

function initials(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default function BookCard({ book, index, onListen, onResume, onDelete }: Props) {
  const [coverError, setCoverError] = useState(false);
  const progress = book.progress;
  const gradient = COVER_GRADIENTS[index % COVER_GRADIENTS.length];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5">
      <div className="relative aspect-[3/4] w-full overflow-hidden">
        {!coverError && book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverUrl}
            alt={`Couverture de ${book.title}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setCoverError(true)}
          />
        ) : (
          <button
            type="button"
            onClick={() => onResume(book)}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br px-4 text-white transition-transform duration-500 group-hover:scale-105",
              gradient,
            )}
          >
            <span className="text-2xl font-bold tracking-wide">
              {initials(book.title)}
            </span>
            <BookOpenGlyph />
          </button>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <button
          type="button"
          onClick={() => onDelete(book)}
          aria-label={`Supprimer ${book.title}`}
          className="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/40 text-white/80 opacity-0 backdrop-blur-sm transition-all hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          {book.title}
        </h3>
        <p className="line-clamp-1 text-sm text-muted-foreground">{book.author}</p>

        {progress ? (
          <div className="mt-1">
            <p className="mb-1.5 text-xs text-muted-foreground">
              Chapitre {progress.chapter}/{progress.totalChapters} · {progress.percent}%
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-gradient transition-all"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">Non commencé</p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onResume(book)}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-gradient px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all hover:opacity-90 active:scale-95"
          >
            {progress ? "Reprendre" : "Commencer"}
          </button>
          <button
            type="button"
            onClick={() => onListen(book)}
            aria-label={`Écouter ${book.title} avec la synthèse vocale`}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <Headphones className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BookOpenGlyph() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-6 w-6 opacity-80"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}
