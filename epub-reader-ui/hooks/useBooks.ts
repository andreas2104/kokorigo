"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_BASE_URL, type BookItem } from "@/types/book";
import { readEpubMetadata } from "@/lib/epub-metadata";
import {
  addPendingDeletion,
  deleteOfflineBook,
  findOfflineBookByServerId,
  linkOfflineBook,
  listOfflineBooks,
  listPendingDeletions,
  readOfflineBook,
  removePendingDeletion,
  saveOfflineBook,
  type OfflineBook,
} from "@/lib/offline-library";

// fetch() ne rejette qu'en cas de panne réseau : le serveur est alors injoignable
// et l'application doit continuer avec la bibliothèque du navigateur.
function isNetworkError(reason: unknown): boolean {
  return reason instanceof TypeError;
}

function toBookItem(book: OfflineBook): BookItem {
  return {
    id: -book.localId,
    localId: book.localId,
    serverId: book.serverId ?? undefined,
    title: book.title,
    author: book.author,
    coverUrl: book.coverDataUrl,
    fileName: book.fileName,
    addedAt: book.addedAt,
    offline: true,
  };
}

async function uploadToServer(file: File): Promise<BookItem> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/my-library/upload`, { method: "POST", body });
  if (!response.ok) throw new Error(await response.text() || "Échec de l’import EPUB");
  return response.json();
}

async function fetchServerBooks(): Promise<BookItem[] | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/my-library`);
    if (!response.ok) return null;
    const books = (await response.json()) as BookItem[];
    return books.map((book) => ({ ...book, serverId: book.id, offline: false }));
  } catch {
    return null;
  }
}

async function fetchBooks(): Promise<BookItem[]> {
  const [offlineBooks, serverBooks] = await Promise.all([
    listOfflineBooks().catch(() => [] as OfflineBook[]),
    fetchServerBooks(),
  ]);

  const localBooks = offlineBooks.map(toBookItem);
  const storedServerIds = new Set(
    localBooks.map((book) => book.serverId).filter((id): id is number => id !== undefined),
  );
  const pendingDeletions = new Set(listPendingDeletions());
  const remoteBooks = (serverBooks ?? []).filter(
    (book) => book.serverId !== undefined
      && !storedServerIds.has(book.serverId)
      && !pendingDeletions.has(book.serverId),
  );

  return [...localBooks, ...remoteBooks].sort((first, second) =>
    (second.addedAt ?? "").localeCompare(first.addedAt ?? ""),
  );
}

export async function uploadBook(file: File): Promise<BookItem> {
  const metadata = await readEpubMetadata(file);
  const stored = await saveOfflineBook(file, metadata).catch(() => null);

  try {
    const uploaded = await uploadToServer(file);
    if (stored) {
      await linkOfflineBook(stored.localId, uploaded.id);
      return { ...toBookItem(stored), serverId: uploaded.id };
    }
    return { ...uploaded, serverId: uploaded.id, offline: false };
  } catch (reason) {
    // Hors ligne, la copie locale suffit : elle sera envoyée à la reconnexion.
    if (stored && isNetworkError(reason)) return toBookItem(stored);
    if (stored) await deleteOfflineBook(stored.localId);
    throw reason;
  }
}

export async function removeBook(book: BookItem): Promise<void> {
  if (book.localId !== undefined) await deleteOfflineBook(book.localId);
  if (book.serverId === undefined) return;

  try {
    const response = await fetch(`${API_BASE_URL}/api/my-library/${book.serverId}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) throw new Error("Impossible de supprimer ce livre");
  } catch (reason) {
    if (!isNetworkError(reason)) throw reason;
    addPendingDeletion(book.serverId);
  }
}

export async function downloadBook(book: BookItem): Promise<File> {
  const localId = book.localId
    ?? (book.serverId !== undefined ? (await findOfflineBookByServerId(book.serverId))?.localId : undefined);
  const stored = localId !== undefined ? await readOfflineBook(localId) : null;
  if (stored) return new File([stored.blob], stored.fileName, { type: "application/epub+zip" });

  if (book.serverId === undefined) throw new Error("Ce livre n’est plus disponible hors ligne.");
  const response = await fetch(`${API_BASE_URL}/api/my-library/file/${book.serverId}`);
  if (!response.ok) throw new Error("Impossible d’ouvrir cet EPUB");

  const file = new File([await response.blob()], book.fileName || `${book.title}.epub`, {
    type: "application/epub+zip",
  });
  // Une fois ouvert, le livre reste lisible sans réseau.
  await saveOfflineBook(file, await readEpubMetadata(file), book.serverId).catch(() => undefined);
  return file;
}

let synchronising = false;

// Rejoue les actions faites hors ligne dès que l'API redevient joignable.
export async function syncOfflineLibrary(): Promise<boolean> {
  if (synchronising || (typeof navigator !== "undefined" && !navigator.onLine)) return false;
  synchronising = true;
  let changed = false;

  try {
    for (const serverId of listPendingDeletions()) {
      const response = await fetch(`${API_BASE_URL}/api/my-library/${serverId}`, { method: "DELETE" });
      if (!response.ok && response.status !== 404) continue;
      removePendingDeletion(serverId);
      changed = true;
    }

    for (const book of await listOfflineBooks()) {
      if (book.serverId !== null) continue;
      const uploaded = await uploadToServer(
        new File([book.blob], book.fileName, { type: "application/epub+zip" }),
      );
      await linkOfflineBook(book.localId, uploaded.id);
      changed = true;
    }
  } catch {
    // L'API reste injoignable : la synchronisation reprendra à la prochaine connexion.
  } finally {
    synchronising = false;
  }

  return changed;
}

export function useBooks() {
  const queryClient = useQueryClient();
  const query = useQuery<BookItem[]>({ queryKey: ["my-library"], queryFn: fetchBooks });

  useEffect(() => {
    const refresh = async (force: boolean) => {
      const changed = await syncOfflineLibrary();
      if (changed || force) await queryClient.invalidateQueries({ queryKey: ["my-library"] });
    };
    void refresh(false);
    const handleOnline = () => void refresh(true);
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [queryClient]);

  return query;
}

export function useLibraryActions() {
  const queryClient = useQueryClient();
  return {
    upload: async (file: File) => {
      const book = await uploadBook(file);
      await queryClient.invalidateQueries({ queryKey: ["my-library"] });
      return book;
    },
    remove: async (book: BookItem) => {
      await removeBook(book);
      await queryClient.invalidateQueries({ queryKey: ["my-library"] });
    },
  };
}
