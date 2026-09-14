"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Voice } from "@/types/voice";
import { TTS_API_URL } from "@/lib/config";
import { loadDeviceVoices } from "@/lib/device-speech";
import {
  LOCAL_PIPER_MODEL_MEGABYTES,
  LOCAL_PIPER_VOICE_ID,
  isLocalPiperInstalled,
  supportsLocalPiper,
} from "@/lib/piper-local";

async function fetchServerVoices(): Promise<Voice[]> {
  try {
    const response = await fetch(`${TTS_API_URL}/api/v1/voices`);
    if (!response.ok) return [];
    return (await response.json()) as Voice[];
  } catch {
    // Serveur injoignable : seules les voix de l'appareil restent utilisables.
    return [];
  }
}

// La voix Piper du serveur, exécutée localement : elle n'est proposée qu'une
// fois son modèle téléchargé, sinon la lecture échouerait au premier paragraphe.
async function localPiperVoice(): Promise<Voice[]> {
  if (!supportsLocalPiper()) return [];
  const installed = await isLocalPiperInstalled();
  return [{
    id: LOCAL_PIPER_VOICE_ID,
    engine: "piper",
    name: "Siwis hors ligne",
    language: "fr-FR",
    character: "Voix du serveur, embarquée",
    description: installed
      ? "Synthèse dans le navigateur, sans réseau"
      : `À télécharger une fois (${LOCAL_PIPER_MODEL_MEGABYTES} Mo)`,
    available: installed,
  }];
}

async function fetchVoices(): Promise<Voice[]> {
  const [serverVoices, localVoices, deviceVoices] = await Promise.all([
    fetchServerVoices(),
    localPiperVoice(),
    loadDeviceVoices(),
  ]);
  return [...serverVoices, ...localVoices, ...deviceVoices];
}

export function useVoices() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["voices"],
    queryFn: fetchVoices,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // Torch takes a few seconds to import in the Docker image. Refresh the
    // inventory until Kokoro's health endpoint becomes available.
    refetchInterval: (query) => query.state.data?.some(
      (voice) => voice.engine !== "piper" && voice.engine !== "device" && !voice.available,
    ) ? 2_000 : false,
  });

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["voices"] });
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    // Les voix du système peuvent arriver après le premier inventaire.
    const speech = "speechSynthesis" in window ? window.speechSynthesis : null;
    speech?.addEventListener("voiceschanged", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      speech?.removeEventListener("voiceschanged", refresh);
    };
  }, [queryClient]);

  return query;
}
