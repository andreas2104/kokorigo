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
  });
}
