export type ReadingProgress = {
  chapter: number;
  totalChapters: number;
  percent: number;
};

export type BookItem = {
  id: number;
  title: string;
  author: string;
  coverUrl: string;
  fileName: string;
  addedAt: string;
  epubUrl?: string;
  format?: "epub";
  progress?: ReadingProgress;
};

export { API_BASE_URL, TTS_API_URL, storedBookUrl } from "@/lib/config";