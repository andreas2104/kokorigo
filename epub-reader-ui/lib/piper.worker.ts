/// <reference lib="webworker" />

// Synthèse Piper exécutée dans le navigateur, hors du fil principal : la
// génération d'un paragraphe prend plusieurs secondes sur téléphone et ne doit
// pas figer l'interface.
import { TtsSession } from "@mintplex-labs/piper-tts-web";
import {
  PIPER_MODEL_FILES as MODEL_FILES,
  PIPER_OPFS_DIRECTORY,
  PIPER_VOICE_ID,
} from "@/lib/piper-model";

export type PiperRequest =
  | { type: "install"; apiBaseUrl: string }
  | { type: "remove" }
  | { type: "speak"; id: number; text: string };

export type PiperResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "installed" }
  | { type: "removed" }
  | { type: "audio"; id: number; wav: Blob }
  | { type: "error"; id?: number; message: string };

const post = (message: PiperResponse) => self.postMessage(message);

async function piperDirectory(create: boolean): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(PIPER_OPFS_DIRECTORY, { create });
}

type OpfsFileHandle = FileSystemFileHandle & {
  createWritable?: () => Promise<FileSystemWritableFileStream>;
  createSyncAccessHandle?: () => Promise<FileSystemSyncAccessHandle>;
};

// La bibliothèque lit l'OPFS avant de télécharger quoi que ce soit : en y
// déposant le modèle servi par notre API, aucun CDN n'est jamais contacté.
async function writeModelFile(directory: FileSystemDirectoryHandle, name: string, data: Blob) {
  const file = (await directory.getFileHandle(name, { create: true })) as OpfsFileHandle;
  if (typeof file.createWritable === "function") {
    const writable = await file.createWritable();
    await writable.write(data);
    await writable.close();
    return;
  }
  // Safari a longtemps réservé l'écriture OPFS aux accès synchrones.
  if (typeof file.createSyncAccessHandle !== "function") {
    throw new Error("Ce navigateur ne permet pas d'enregistrer le modèle vocal.");
  }
  const handle = await file.createSyncAccessHandle();
  try {
    handle.write(new Uint8Array(await data.arrayBuffer()), { at: 0 });
    handle.flush();
  } finally {
    handle.close();
  }
}

async function download(
  url: string,
  onTotal: (bytes: number) => void,
  onChunk: (bytes: number) => void,
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Téléchargement impossible (${response.status})`);
  onTotal(Number(response.headers.get("content-length")) || 0);
  if (!response.body) return response.blob();

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    onChunk(value.byteLength);
  }
  return new Blob(chunks as BlobPart[]);
}

async function install(apiBaseUrl: string) {
  const directory = await piperDirectory(true);
  // Le fichier de configuration ne pèse que quelques kilo-octets : la
  // progression suit la taille du modèle, annoncée par la première réponse.
  let total = 0;
  let loaded = 0;

  for (const name of MODEL_FILES) {
    const blob = await download(
      `${apiBaseUrl}/api/v1/tts/model/${name}`,
      (bytes) => {
        total = total || bytes;
      },
      (bytes) => {
        loaded += bytes;
        post({ type: "progress", loaded, total });
      },
    );
    await writeModelFile(directory, name, blob);
  }
  post({ type: "installed" });
}

let session: TtsSession | null = null;

async function ensureSession(): Promise<TtsSession> {
  if (session) return session;
  const base = self.location.origin;
  session = await TtsSession.create({
    voiceId: PIPER_VOICE_ID as never,
    wasmPaths: {
      onnxWasm: `${base}/piper/`,
      piperData: `${base}/piper/piper_phonemize.data`,
      piperWasm: `${base}/piper/piper_phonemize.wasm`,
    },
  });
  return session;
}

self.onmessage = async (event: MessageEvent<PiperRequest>) => {
  const request = event.data;
  try {
    if (request.type === "install") {
      await install(request.apiBaseUrl);
      return;
    }
    if (request.type === "remove") {
      const directory = await piperDirectory(true);
      for (const name of MODEL_FILES) await directory.removeEntry(name).catch(() => undefined);
      session = null;
      post({ type: "removed" });
      return;
    }
    if (request.type === "speak") {
      const engine = await ensureSession();
      post({ type: "audio", id: request.id, wav: await engine.predict(request.text) });
    }
  } catch (reason) {
    session = null;
    post({
      type: "error",
      id: request.type === "speak" ? request.id : undefined,
      message: reason instanceof Error ? reason.message : "Synthèse locale impossible",
    });
  }
};
