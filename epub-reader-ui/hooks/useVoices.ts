"use client";

import { useQuery } from "@tanstack/react-query";
import type { Voice } from "@/types/voice";
import { TTS_API_URL } from "@/lib/config";

async function fetchVoices(): Promise<Voice[]> {
  const response = await fetch(`${TTS_API_URL}/api/v1/voices`);
  if (!response.ok) throw new Error(`Erreur inventaire des voix (${response.status})`);
  return response.json() as Promise<Voice[]>;
}

export function useVoices() {
  return useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // Torch takes a few seconds to import in the Docker image. Refresh the
    // inventory until Kokoro's health endpoint becomes available.
    refetchInterval: (query) => query.state.data?.some(
      (voice) => voice.engine !== "piper" && !voice.available,
    ) ? 2_000 : false,
  });
}
