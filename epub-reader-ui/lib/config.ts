export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5089";

// Piper TTS est servi par l'API C# (EpubLibrary) sur le même hôte.
// On retombe sur API_BASE_URL plutôt que sur un faux port 5000.
export const TTS_API_URL =
  process.env.NEXT_PUBLIC_TTS_API_URL ?? API_BASE_URL;

export function storedBookUrl(id: number): string {
  return `${API_BASE_URL}/api/my-library/file/${id}`;
}