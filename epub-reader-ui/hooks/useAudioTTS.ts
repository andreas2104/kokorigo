"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TTS_API_URL } from "@/lib/config";

export type TTSOptions = {
  voice: string;
  speed: number;
};

export async function requestTtsAudio(text: string, options: TTSOptions): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${TTS_API_URL}/api/v1/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, ...options }),
    });
  } catch {
    throw new Error(`Service vocal indisponible (${TTS_API_URL})`);
  }

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Erreur de synthèse vocale (${response.status})`);
  }

  return URL.createObjectURL(await response.blob());
}

export function audioTTSKey(text: string, index: number, options: TTSOptions) {
  return ["tts", text, index, options.voice, options.speed] as const;
}

export function useAudioTTS(
  text: string,
  paragraphIndex: number,
  nextText: string | undefined,
  options: TTSOptions,
  enabled: boolean,
) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: audioTTSKey(text, paragraphIndex, options),
    queryFn: () => requestTtsAudio(text, options),
    enabled: enabled && text.trim().length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  const prefetchNext = () => {
    if (!nextText?.trim()) return;
    void queryClient.prefetchQuery({
      queryKey: audioTTSKey(nextText, paragraphIndex + 1, options),
      queryFn: () => requestTtsAudio(nextText, options),
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
    });
  };

  return { ...query, prefetchNext };
}
