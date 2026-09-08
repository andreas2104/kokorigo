"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL, type BookItem } from "@/types/book";

async function fetchBooks(): Promise<BookItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/my-library`);
  if (!response.ok) throw new Error(`Impossible de charger la bibliothèque (${response.status})`);
  return response.json();
}

export async function uploadBook(file: File): Promise<BookItem> {
  const body = new FormData(); body.append("file", file);
  const response = await fetch(`${API_BASE_URL}/api/my-library/upload`, { method: "POST", body });
  if (!response.ok) throw new Error(await response.text() || "Échec de l’import EPUB");
  return response.json();
}

export async function removeBook(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/my-library/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Impossible de supprimer ce livre");
}

export async function downloadBook(id: number): Promise<File> {
  const response = await fetch(`${API_BASE_URL}/api/my-library/file/${id}`);
  if (!response.ok) throw new Error("Impossible d’ouvrir cet EPUB");
  return new File([await response.blob()], "book.epub", { type: "application/epub+zip" });
}

export function useBooks() {
  return useQuery<BookItem[]>({ queryKey: ["my-library"], queryFn: fetchBooks });
}

export function useLibraryActions() {
  const queryClient = useQueryClient();
  return {
    upload: async (file: File) => { const book = await uploadBook(file); await queryClient.invalidateQueries({ queryKey: ["my-library"] }); return book; },
    remove: async (id: number) => { await removeBook(id); await queryClient.invalidateQueries({ queryKey: ["my-library"] }); },
  };
}
