"use client";

import { API_BASE_URL } from "@/lib/config";
import {
  PIPER_DOWNLOAD_MEGABYTES,
  PIPER_MODEL_FILES,
  PIPER_OPFS_DIRECTORY,
  PIPER_VOICE_ID,
} from "@/lib/piper-model";
import type { PiperRequest, PiperResponse } from "@/lib/piper.worker";

// Voix Piper du serveur, exécutée par le navigateur : même modèle, sans réseau.
export const LOCAL_PIPER_VOICE_ID = `local:piper:${PIPER_VOICE_ID}`;
export const LOCAL_PIPER_MODEL_MEGABYTES = PIPER_DOWNLOAD_MEGABYTES;

export function isLocalPiperVoice(voiceId: string): boolean {
  return voiceId === LOCAL_PIPER_VOICE_ID;
}

export type LocalPiperSupport = { supported: boolean; reason: string };

// Explique pourquoi la voix embarquée est indisponible : sans message, la carte
// disparaissait simplement, sans que l'utilisateur comprenne.
export function describeLocalPiperSupport(): LocalPiperSupport {
  if (typeof window === "undefined") return { supported: false, reason: "" };
  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: "Cette page doit être ouverte en HTTPS (ou depuis localhost) pour installer la voix.",
    };
  }
  if (typeof Worker === "undefined" || typeof navigator.storage?.getDirectory !== "function") {
    return {
      supported: false,
      reason: "Ce navigateur ne fournit pas le stockage nécessaire. Ouvrez le lien dans Chrome ou "
        + "Safari, hors navigation privée : les navigateurs intégrés à Facebook, WhatsApp ou "
        + "Instagram ne conviennent pas.",
    };
  }
  return { supported: true, reason: "" };
}

export function supportsLocalPiper(): boolean {
  return describeLocalPiperSupport().supported;
}

type PendingSpeech = { resolve: (wav: Blob) => void; reject: (reason: Error) => void };

let worker: Worker | null = null;
let requestCounter = 0;
const pendingSpeech = new Map<number, PendingSpeech>();
let pendingInstall: { resolve: () => void; reject: (reason: Error) => void } | null = null;
let progressListener: ((loaded: number, total: number) => void) | null = null;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./piper.worker.ts", import.meta.url));
  worker.onmessage = (event: MessageEvent<PiperResponse>) => {
    const message = event.data;
    if (message.type === "progress") progressListener?.(message.loaded, message.total);
    if (message.type === "installed" || message.type === "removed") pendingInstall?.resolve();
    if (message.type === "audio") pendingSpeech.get(message.id)?.resolve(message.wav);
    if (message.type === "audio") pendingSpeech.delete(message.id);
    if (message.type === "error") {
      const failure = new Error(message.message);
      if (message.id !== undefined) {
        pendingSpeech.get(message.id)?.reject(failure);
        pendingSpeech.delete(message.id);
      } else {
        pendingInstall?.reject(failure);
      }
    }
  };
  return worker;
}

function send(request: PiperRequest) {
  getWorker().postMessage(request);
}

// Lu directement depuis la fenêtre : inutile de charger le worker de synthèse
// (et ses quelques Mo de WebAssembly) juste pour afficher l'état de la voix.
export async function isLocalPiperInstalled(): Promise<boolean> {
  if (!supportsLocalPiper()) return false;
  try {
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(PIPER_OPFS_DIRECTORY);
    for (const name of PIPER_MODEL_FILES) await directory.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

function downloadModel(onProgress?: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingInstall = { resolve, reject };
    progressListener = (loaded, total) => onProgress?.(total ? Math.min(1, loaded / total) : 0);
    send({ type: "install", apiBaseUrl: API_BASE_URL });
  });
}

export async function installLocalPiper(onProgress?: (ratio: number) => void): Promise<void> {
  await downloadModel(onProgress);
  // Une première synthèse tant que le réseau est là : elle charge le worker et
  // les binaires WebAssembly, que le service worker met alors en cache. Sans
  // elle, la voix serait inutilisable à la première coupure de connexion.
  await synthesizeWithLocalPiper("Bonjour.");
}

export function removeLocalPiper(): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingInstall = { resolve, reject };
    send({ type: "remove" });
  });
}

export function synthesizeWithLocalPiper(text: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const id = (requestCounter += 1);
    pendingSpeech.set(id, { resolve, reject });
    send({ type: "speak", id, text });
  });
}
