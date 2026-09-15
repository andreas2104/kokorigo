export type VoiceEngine = "piper" | "kokoro" | "f5tts" | "device" | "piper-local";

export type Voice = {
  id: string;
  engine: VoiceEngine;
  name: string;
  language: string;
  character: string;
  description?: string;
  model?: string;
  available: boolean;
};

// Les libellés doivent rester distinguables d'un coup d'œil dans la liste
// déroulante : « Siwis · Piper » (serveur) ne doit pas être confondu avec
// « Siwis · Piper embarqué » (téléchargé sur l'appareil).
const ENGINE_LABELS: Record<VoiceEngine, string> = {
  piper: "Piper · serveur",
  kokoro: "Kokoro · serveur",
  f5tts: "F5-TTS · serveur",
  device: "Voix du système",
  "piper-local": "Piper embarqué",
};

export function engineLabel(engine: VoiceEngine): string {
  return ENGINE_LABELS[engine] ?? ENGINE_LABELS.piper;
}
