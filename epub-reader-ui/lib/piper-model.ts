// Modèle Piper partagé entre la fenêtre et le worker de synthèse.
// C'est celui qu'utilise l'API (assets/tts/piper), servi par /api/v1/tts/model.
export const PIPER_VOICE_ID = "fr_FR-siwis-medium";

export const PIPER_MODEL_FILES = [`${PIPER_VOICE_ID}.onnx`, `${PIPER_VOICE_ID}.onnx.json`];

// Modèle + moteur WebAssembly (phonémiseur et ONNX Runtime) : ce que le
// téléphone télécharge réellement la première fois.
export const PIPER_DOWNLOAD_MEGABYTES = 90;

// Nom du dossier attendu par @mintplex-labs/piper-tts-web dans l'OPFS : en y
// déposant nous-mêmes le modèle, la bibliothèque ne contacte jamais son CDN.
export const PIPER_OPFS_DIRECTORY = "piper";
