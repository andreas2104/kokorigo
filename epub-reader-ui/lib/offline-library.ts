"use client";

import type { EpubMetadata } from "@/lib/epub-metadata";

const DATABASE_NAME = "kokorigo-library";
const DATABASE_VERSION = 1;
const STORE_NAME = "books";
const PENDING_DELETIONS_KEY = "kokorigo:pending-deletions";

export type OfflineBook = {
  localId: number;
  serverId: number | null;
  title: string;
  author: string;
  fileName: string;
  addedAt: string;
  coverDataUrl: string;
  size: number;
  blob: Blob;
};

type NewOfflineBook = Omit<OfflineBook, "localId">;

export function supportsOfflineLibrary(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!supportsOfflineLibrary()) {
      reject(new Error("Le stockage hors ligne n’est pas disponible dans ce navigateur."));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "localId", autoIncrement: true });
        store.createIndex("serverId", "serverId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Base locale inaccessible"));
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Opération locale impossible"));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    return await work(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
  } finally {
    database.close();
  }
}

export async function listOfflineBooks(): Promise<OfflineBook[]> {
  if (!supportsOfflineLibrary()) return [];
  const books = await withStore("readonly", (store) => promisify(store.getAll() as IDBRequest<OfflineBook[]>));
  return books.sort((first, second) => second.addedAt.localeCompare(first.addedAt));
}

export async function findOfflineBookByServerId(serverId: number): Promise<OfflineBook | null> {
  if (!supportsOfflineLibrary()) return null;
  const book = await withStore("readonly", (store) =>
    promisify(store.index("serverId").get(serverId) as IDBRequest<OfflineBook | undefined>),
  );
  return book ?? null;
}

export async function readOfflineBook(localId: number): Promise<OfflineBook | null> {
  if (!supportsOfflineLibrary()) return null;
  const book = await withStore("readonly", (store) =>
    promisify(store.get(localId) as IDBRequest<OfflineBook | undefined>),
  );
  return book ?? null;
}

// Un même fichier réimporté remplace sa copie locale au lieu de la dupliquer.
export async function saveOfflineBook(
  file: File,
  metadata: EpubMetadata,
  serverId: number | null = null,
): Promise<OfflineBook> {
  const candidate: NewOfflineBook = {
    serverId,
    title: metadata.title,
    author: metadata.author,
    fileName: file.name,
    addedAt: new Date().toISOString(),
    coverDataUrl: metadata.coverDataUrl,
    size: file.size,
    blob: file,
  };

  return withStore("readwrite", async (store) => {
    const existing = (await promisify(store.getAll() as IDBRequest<OfflineBook[]>)).find(
      (book) => book.fileName === file.name && book.size === file.size,
    );
    const record = existing
      ? { ...candidate, localId: existing.localId, serverId: serverId ?? existing.serverId, addedAt: existing.addedAt }
      : candidate;
    const localId = Number(await promisify(store.put(record) as IDBRequest<IDBValidKey>));
    return { ...record, localId };
  });
}

export async function linkOfflineBook(localId: number, serverId: number): Promise<void> {
  await withStore("readwrite", async (store) => {
    const book = await promisify(store.get(localId) as IDBRequest<OfflineBook | undefined>);
    if (book) await promisify(store.put({ ...book, serverId }) as IDBRequest<IDBValidKey>);
  });
}

export async function deleteOfflineBook(localId: number): Promise<void> {
  if (!supportsOfflineLibrary()) return;
  await withStore("readwrite", (store) => promisify(store.delete(localId) as IDBRequest<undefined>));
}

// Une suppression faite hors ligne est rejouée sur l'API à la reconnexion,
// sinon le livre effacé réapparaîtrait au prochain chargement.
function readPendingDeletions(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(PENDING_DELETIONS_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

function writePendingDeletions(serverIds: number[]): void {
  try {
    localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(serverIds));
  } catch {
    // Sans stockage local, la suppression ne sera simplement pas rejouée.
  }
}

export function listPendingDeletions(): number[] {
  if (typeof localStorage === "undefined") return [];
  return readPendingDeletions();
}

export function addPendingDeletion(serverId: number): void {
  if (typeof localStorage === "undefined") return;
  const pending = readPendingDeletions();
  if (!pending.includes(serverId)) writePendingDeletions([...pending, serverId]);
}

export function removePendingDeletion(serverId: number): void {
  if (typeof localStorage === "undefined") return;
  writePendingDeletions(readPendingDeletions().filter((id) => id !== serverId));
}
