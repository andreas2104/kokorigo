"use client";

import { Library, Loader2 } from "lucide-react";
import BookCard from "@/components/BookCard";
import type { BookItem } from "@/types/book";

type Props = {
  books: BookItem[];
  isLoading: boolean;
  onBrowse: () => void;
  onListen: (book: BookItem) => void;
  onResume: (book: BookItem) => void;
  onDelete: (book: BookItem) => void;
};

export default function LibrarySection({
  books,
  isLoading,
  onBrowse,
  onListen,
  onResume,
  onDelete,
}: Props) {
  return (
    <section className="mt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Library className="h-5 w-5 text-primary" aria-hidden="true" />
            Bibliothèque
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vos livres récents · {books.length} {books.length > 1 ? "titres" : "titre"}
          </p>
        </div>
        {isLoading && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Chargement" />
        )}
      </div>

      {books.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
          {books.map((book, index) => (
            <BookCard
              key={book.id}
              book={book}
              index={index}
              onListen={onListen}
              onResume={onResume}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border bg-card/50 p-10 text-center">
          <p className="text-muted-foreground">
            Aucun livre dans votre bibliothèque pour le moment.
          </p>
          <button
            type="button"
            onClick={onBrowse}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:opacity-90 active:scale-95"
          >
            Importer votre premier EPUB
          </button>
        </div>
      )}
    </section>
  );
}