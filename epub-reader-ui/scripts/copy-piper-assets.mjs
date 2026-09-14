// Copie les binaires WebAssembly de Piper et d'ONNX Runtime dans public/piper.
// L'application les sert depuis sa propre origine : aucun CDN n'est contacté,
// ce qui est indispensable pour la synthèse vocale hors ligne.
import { createRequire } from "node:module";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const require = createRequire(resolve("package.json"));
const piperBuild = join(dirname(require.resolve("@diffusionstudio/piper-wasm/package.json")), "build");
const onnxDist = dirname(require.resolve("onnxruntime-web"));
const destination = resolve("public/piper");

// ONNX Runtime choisit lui-même sa variante selon le navigateur (SIMD, threads) :
// les trois doivent être disponibles, le client n'en télécharge qu'une.
const FILES = [
  join(piperBuild, "piper_phonemize.wasm"),
  join(piperBuild, "piper_phonemize.data"),
  join(onnxDist, "ort-wasm-simd-threaded.wasm"),
  join(onnxDist, "ort-wasm-simd.wasm"),
  join(onnxDist, "ort-wasm.wasm"),
];

mkdirSync(destination, { recursive: true });

let total = 0;
for (const source of FILES) {
  const name = source.split(/[\\/]/).at(-1);
  copyFileSync(source, join(destination, name));
  total += statSync(source).size;
}

console.log(`piper: ${FILES.length} fichiers copiés dans public/piper (${(total / 1048576).toFixed(1)} Mo)`);
