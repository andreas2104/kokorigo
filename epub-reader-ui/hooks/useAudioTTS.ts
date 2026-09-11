"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { TTS_API_URL } from "@/lib/config";
import { sanitizeTextForSpeech } from "@/lib/speech-text";

export type TTSOptions = {
  voice: string;
  speed: number;
};

export async function requestTtsAudio(text: string, options: TTSOptions, signal?: AbortSignal): Promise<string> {
  const speechText = sanitizeTextForSpeech(text);
  if (!speechText) throw new Error("Aucun texte lisible pour la synthèse vocale.");
  let response: Response;
  try {
    response = await fetch(`${TTS_API_URL}/api/v1/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: speechText, ...options }),
      signal,
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
  const queryKey = useMemo(
    () => audioTTSKey(text, paragraphIndex, options),
    [options.speed, options.voice, paragraphIndex, text],
  );
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => requestTtsAudio(text, options, signal),
    enabled: enabled && text.trim().length > 0,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  useEffect(() => () => {
    void queryClient.cancelQueries({ queryKey, exact: true });
  }, [options.speed, options.voice, paragraphIndex, queryClient, text]);

  const prefetchNext = useCallback(() => {
    if (!nextText?.trim()) return;
    void queryClient.prefetchQuery({
      queryKey: audioTTSKey(nextText, paragraphIndex + 1, options),
      queryFn: ({ signal }) => requestTtsAudio(nextText, options, signal),
      staleTime: Infinity,
      gcTime: 30 * 60 * 1000,
    });
  }, [nextText, options.speed, options.voice, paragraphIndex, queryClient]);

  const cancel = useCallback(
    () => queryClient.cancelQueries({ queryKey, exact: true }),
    [queryClient, queryKey],
  );

  return { ...query, prefetchNext, cancel };
}
