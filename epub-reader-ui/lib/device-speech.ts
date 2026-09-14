"use client";

import type { Voice } from "@/types/voice";
import { wordIndexAtProgress, buildWordTimings, type TextToken } from "@/lib/word-timing";

export const DEVICE_VOICE_PREFIX = "device:";

// Vitesse moyenne d'une voix système, utilisée quand le navigateur n'émet pas
// d'événement « boundary » (cas de Safari iOS) pour suivre les mots.
const CHARACTERS_PER_SECOND = 14;
const BOUNDARY_GRACE_MS = 1200;
// Chrome interrompt les énoncés longs : une pause/reprise régulière les relance.
const KEEP_ALIVE_MS = 10_000;

export function supportsDeviceSpeech(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isDeviceVoice(voiceId: string): boolean {
  return voiceId.startsWith(DEVICE_VOICE_PREFIX);
}

function listSystemVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!supportsDeviceSpeech()) {
      resolve([]);
      return;
    }
    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length) {
      resolve(immediate);
      return;
    }
    // La liste arrive de façon asynchrone au premier chargement de la page.
    const timer = window.setTimeout(() => finish(), 1500);
    const finish = () => {
      window.clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
  });
}

function findSystemVoice(voices: SpeechSynthesisVoice[], voiceId: string): SpeechSynthesisVoice | undefined {
  const voiceUri = voiceId.slice(DEVICE_VOICE_PREFIX.length);
  return voices.find((voice) => voice.voiceURI === voiceUri)
    ?? voices.find((voice) => voice.name === voiceUri);
}

export async function loadDeviceVoices(language = "fr"): Promise<Voice[]> {
  const systemVoices = await listSystemVoices();
  // Les voix « localService » sont embarquées : elles seules parlent hors ligne.
  const embedded = systemVoices.filter((voice) => voice.localService);
  const usable = embedded.length ? embedded : systemVoices;

  return usable
    .sort((first, second) =>
      Number(second.lang.startsWith(language)) - Number(first.lang.startsWith(language))
      || first.name.localeCompare(second.name),
    )
    .map((voice) => ({
      id: `${DEVICE_VOICE_PREFIX}${voice.voiceURI}`,
      engine: "device" as const,
      name: voice.name,
      language: voice.lang,
      character: voice.localService ? "Voix de l’appareil" : "Voix en ligne",
      description: voice.localService
        ? "Fonctionne sans connexion"
        : "Nécessite une connexion Internet",
      available: true,
    }));
}

type SpeechRequest = {
  text: string;
  tokens: TextToken[];
  voiceId: string;
  rate: number;
  onWordIndex: (wordIndex: number | null) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

function buildCharacterRanges(tokens: TextToken[]) {
  const ranges: Array<{ end: number; wordIndex: number }> = [];
  let offset = 0;
  for (const token of tokens) {
    offset += token.text.length;
    if (token.wordIndex !== null) ranges.push({ end: offset, wordIndex: token.wordIndex });
  }
  return ranges;
}

// Lit un paragraphe avec la synthèse vocale intégrée au téléphone : aucun appel
// réseau, donc disponible hors ligne. Renvoie la fonction d'arrêt.
export function speakWithDevice(request: SpeechRequest): () => void {
  if (!supportsDeviceSpeech()) {
    request.onError("La synthèse vocale de l’appareil n’est pas disponible.");
    return () => undefined;
  }

  const synthesis = window.speechSynthesis;
  const ranges = buildCharacterRanges(request.tokens);
  const timings = buildWordTimings(request.tokens);
  const utterance = new SpeechSynthesisUtterance(request.text);
  let stopped = false;
  let estimationTimer = 0;
  let keepAliveTimer = 0;
  let fallbackTimer = 0;
  let boundarySupported = false;

  const clearTimers = () => {
    window.clearInterval(estimationTimer);
    window.clearInterval(keepAliveTimer);
    window.clearTimeout(fallbackTimer);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearTimers();
    synthesis.cancel();
  };

  const startedAt = Date.now();
  const estimatedMs = (request.text.length / CHARACTERS_PER_SECOND / Math.max(0.1, request.rate)) * 1000;
  fallbackTimer = window.setTimeout(() => {
    if (boundarySupported || stopped) return;
    estimationTimer = window.setInterval(() => {
      request.onWordIndex(wordIndexAtProgress(timings, (Date.now() - startedAt) / estimatedMs));
    }, 120);
  }, BOUNDARY_GRACE_MS);

  void listSystemVoices().then((voices) => {
    if (stopped) return;
    const systemVoice = findSystemVoice(voices, request.voiceId);
    if (systemVoice) {
      utterance.voice = systemVoice;
      utterance.lang = systemVoice.lang;
    }
    utterance.rate = Math.min(2, Math.max(0.5, request.rate));

    utterance.onboundary = (event) => {
      if (event.name && event.name !== "word") return;
      boundarySupported = true;
      window.clearInterval(estimationTimer);
      request.onWordIndex(
        ranges.find((range) => event.charIndex < range.end)?.wordIndex
        ?? ranges[ranges.length - 1]?.wordIndex
        ?? null,
      );
    };
    utterance.onend = () => {
      if (stopped) return;
      stopped = true;
      clearTimers();
      request.onEnd();
    };
    utterance.onerror = (event) => {
      if (stopped || event.error === "interrupted" || event.error === "canceled") return;
      stopped = true;
      clearTimers();
      request.onError("La voix de l’appareil n’a pas pu lire ce paragraphe.");
    };

    synthesis.cancel();
    synthesis.speak(utterance);
    keepAliveTimer = window.setInterval(() => {
      if (stopped || !synthesis.speaking) return;
      synthesis.pause();
      synthesis.resume();
    }, KEEP_ALIVE_MS);
  });

  return stop;
}
