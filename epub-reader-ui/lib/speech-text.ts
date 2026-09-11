const SILENT_FORMATTING = /[*#\[\]`_~©®™]/g;
const DASHES = /[-–—]+/g;

export function sanitizeTextForSpeech(text: string): string {
  return text
    .replace(SILENT_FORMATTING, " ")
    .replace(DASHES, " ")
    .replace(/!+/g, ".")
    .replace(/\s+([,.?])/g, "$1")
    .replace(/([,.?])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}
