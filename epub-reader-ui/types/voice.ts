export type VoiceEngine = "piper" | "kokoro" | "f5tts" | "device";

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

const ENGINE_LABELS: Record<VoiceEngine, string> = {
  piper: "Piper",
  kokoro: "Kokoro",
  f5tts: "F5-TTS",
  device: "Appareil",
};

export function engineLabel(engine: VoiceEngine): string {
  return ENGINE_LABELS[engine] ?? ENGINE_LABELS.piper;
}
