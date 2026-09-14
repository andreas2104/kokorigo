export type ReadingProgress = {
  chapter: number;
  totalChapters: number;
  percent: number;
};

export type BookItem = {
  // Identifiant d'affichage : négatif pour une copie locale, positif côté API.
  id: number;
  title: string;
  author: string;
  coverUrl: string;
  fileName: string;
  addedAt: string;
  epubUrl?: string;
  format?: "epub";
  progress?: ReadingProgress;
  localId?: number;
  serverId?: number;
  offline?: boolean;
};

export { API_BASE_URL, TTS_API_URL, storedBookUrl } from "@/lib/config";