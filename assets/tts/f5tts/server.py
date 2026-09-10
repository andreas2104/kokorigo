#!/usr/bin/env python3
"""Persistent, local-only HTTP bridge for the French F5-TTS engine."""

from __future__ import annotations

import io
import importlib.util
import json
import os
import re
import threading
import time
import unicodedata
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


HOST = "127.0.0.1"
PORT = int(os.getenv("F5_TTS_PORT", "8881"))
MAX_TEXT_LENGTH = int(os.getenv("F5_TTS_MAX_TEXT_LENGTH", "5000"))
MAX_SEGMENT_CHARS = int(os.getenv("F5_TTS_MAX_SEGMENT_CHARS", "500"))
MODEL_NAME = os.getenv("F5_TTS_MODEL_NAME", "F5TTS_Base")
MODEL_PATH = os.getenv(
    "F5_TTS_MODEL_PATH",
    "hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/model_last_reduced.pt",
)
VOCAB_PATH = os.getenv(
    "F5_TTS_VOCAB_PATH",
    "hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/vocab.txt",
)
MODEL_VERSION = os.getenv("F5_TTS_MODEL_VERSION", "raspiaudio-french-reduced-v1")
CACHE_DIR = os.getenv("F5_TTS_CACHE_DIR") or None
BASE_DIRECTORY = Path(__file__).resolve().parent
VOICES_PATH = Path(os.getenv("F5_TTS_VOICES_CONFIG", BASE_DIRECTORY / "voices.json"))


@dataclass(frozen=True)
class VoiceConfig:
    id: str
    name: str
    reference_audio: Path
    reference_text: str


def _resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else BASE_DIRECTORY / path


def _load_voices() -> dict[str, VoiceConfig]:
    if not VOICES_PATH.is_file():
        return {}
    payload = json.loads(VOICES_PATH.read_text(encoding="utf-8"))
    voices: dict[str, VoiceConfig] = {}
    for item in payload.get("voices", []):
        voice_id = str(item.get("id", "")).strip()
        audio_path = _resolve_path(str(item.get("referenceAudio", "")))
        text_path = _resolve_path(str(item.get("referenceText", "")))
        if voice_id and audio_path.is_file() and text_path.is_file():
            voices[voice_id] = VoiceConfig(
                id=voice_id,
                name=str(item.get("name", voice_id)),
                reference_audio=audio_path,
                reference_text=text_path.read_text(encoding="utf-8").strip(),
            )
    return voices


VOICES = _load_voices()
_engine: Any = None
_device = "unknown"
_model_lock = threading.Lock()
_inference_lock = threading.Lock()


def dependency_error() -> str | None:
    missing = [name for name in ("f5_tts", "torch", "soundfile") if importlib.util.find_spec(name) is None]
    if missing:
        return f"Dépendances F5-TTS absentes: {', '.join(missing)}"
    if not VOICES:
        return f"Aucune voix F5-TTS valide dans {VOICES_PATH} (audio et texte de référence requis)."
    return None


def _resolve_model_file(location: str) -> str:
    if not location.startswith("hf://"):
        path = Path(location)
        if not path.is_file():
            raise FileNotFoundError(f"Fichier de modèle F5-TTS absent: {path}")
        return str(path)
    from cached_path import cached_path

    return str(cached_path(location, cache_dir=CACHE_DIR))


def get_engine() -> Any:
    global _device, _engine
    if _engine is not None:
        return _engine

    with _model_lock:
        if _engine is not None:
            return _engine
        error = dependency_error()
        if error:
            raise RuntimeError(error)

        import torch
        from f5_tts.api import F5TTS

        _device = (
            "cuda" if torch.cuda.is_available()
            else "xpu" if hasattr(torch, "xpu") and torch.xpu.is_available()
            else "mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
            else "cpu"
        )
        print(f"[f5tts] Loading {MODEL_VERSION} on {_device}", flush=True)
        _engine = F5TTS(
            model=MODEL_NAME,
            ckpt_file=_resolve_model_file(MODEL_PATH),
            vocab_file=_resolve_model_file(VOCAB_PATH),
            device=_device,
            hf_cache_dir=CACHE_DIR,
        )
        print(f"[f5tts] Model ready on {_device}", flush=True)
        return _engine


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", text)).strip()


def segment_text(text: str, max_chars: int = MAX_SEGMENT_CHARS) -> list[str]:
    sentences = re.split(r"(?<=[.!?…;:])\s+", text)
    segments: list[str] = []
    current = ""

    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        candidate = f"{current} {sentence}".strip()
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            segments.append(current)
        current = ""
        words = sentence.split()
        for word in words:
            candidate = f"{current} {word}".strip()
            if len(candidate) <= max_chars:
                current = candidate
            else:
                if current:
                    segments.append(current)
                current = word

    if current:
        segments.append(current)
    return segments


def _cross_fade(left: Any, right: Any, sample_rate: int, seconds: float = 0.12) -> Any:
    import numpy as np

    overlap = min(int(sample_rate * seconds), len(left), len(right))
    if overlap <= 0:
        return np.concatenate((left, right))
    fade_out = np.linspace(1.0, 0.0, overlap, dtype=np.float32)
    fade_in = 1.0 - fade_out
    return np.concatenate((left[:-overlap], left[-overlap:] * fade_out + right[:overlap] * fade_in, right[overlap:]))


def synthesize(text: str, voice_id: str, speed: float, language: str = "fr-FR") -> tuple[bytes, dict[str, Any]]:
    normalized = normalize_text(text)
    if not normalized:
        raise ValueError("Le texte à synthétiser est vide.")
    if len(normalized) > MAX_TEXT_LENGTH:
        raise ValueError(f"Le texte dépasse {MAX_TEXT_LENGTH} caractères.")
    if language.lower() not in {"fr", "fr-fr"}:
        raise ValueError("F5-TTS est configuré uniquement pour le français.")
    if not 0.5 <= speed <= 2.0:
        raise ValueError("La vitesse doit être comprise entre 0.5 et 2.0.")
    voice = VOICES.get(voice_id)
    if voice is None:
        raise ValueError(f"Voix F5-TTS non autorisée: {voice_id}")

    started = time.perf_counter()
    engine = get_engine()
    generated: list[Any] = []
    sample_rate = 24_000

    with _inference_lock:
        for segment in segment_text(normalized):
            wave, sample_rate, _ = engine.infer(
                ref_file=str(voice.reference_audio),
                ref_text=voice.reference_text,
                gen_text=segment,
                speed=speed,
            )
            generated.append(wave)

    if not generated:
        raise RuntimeError("F5-TTS n'a généré aucun son.")
    audio = generated[0]
    for next_audio in generated[1:]:
        audio = _cross_fade(audio, next_audio, sample_rate)

    import soundfile as sf

    output = io.BytesIO()
    sf.write(output, audio, sample_rate, format="WAV", subtype="PCM_16")
    generation_seconds = time.perf_counter() - started
    audio_seconds = len(audio) / sample_rate
    return output.getvalue(), {
        "device": _device,
        "model": MODEL_VERSION,
        "generationSeconds": generation_seconds,
        "audioSeconds": audio_seconds,
        "rtf": generation_seconds / audio_seconds if audio_seconds else 0,
        "segments": len(generated),
    }


class F5TtsHandler(BaseHTTPRequestHandler):
    server_version = "KokorigoF5TTS/1.0"

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/health":
            self.send_error(404)
            return
        error = dependency_error()
        self.send_json(503 if error else 200, {
            "status": "unavailable" if error else "ok",
            "error": error,
            "device": _device,
            "model": MODEL_VERSION,
            "modelLoaded": _engine is not None,
            "voices": sorted(VOICES),
        })

    def do_POST(self) -> None:  # noqa: N802
        if self.path.rstrip("/") != "/synthesize":
            self.send_error(404)
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 100_000:
                raise ValueError("Taille de requête invalide.")
            payload: dict[str, Any] = json.loads(self.rfile.read(content_length))
            wav, metrics = synthesize(
                str(payload.get("text", "")),
                str(payload.get("voice", "")),
                float(payload.get("speed", 1.0)),
                str(payload.get("language", "fr-FR")),
            )
            print(
                f"[f5tts] chars={len(str(payload.get('text', '')))} generation={metrics['generationSeconds']:.2f}s "
                f"audio={metrics['audioSeconds']:.2f}s rtf={metrics['rtf']:.3f} device={metrics['device']}",
                flush=True,
            )
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav)))
            self.send_header("X-TTS-Device", str(metrics["device"]))
            self.send_header("X-TTS-Generation-Seconds", f"{metrics['generationSeconds']:.3f}")
            self.send_header("X-TTS-Audio-Seconds", f"{metrics['audioSeconds']:.3f}")
            self.send_header("X-TTS-RTF", f"{metrics['rtf']:.3f}")
            self.end_headers()
            self.wfile.write(wav)
        except (BrokenPipeError, ConnectionResetError):
            return
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except FileNotFoundError as error:
            self.send_json(503, {"error": str(error)})
        except Exception as error:
            message = str(error)
            if "out of memory" in message.lower():
                message = "Mémoire insuffisante pour F5-TTS. Essayez le CPU ou libérez la mémoire GPU."
            self.send_json(500, {"error": message})

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def log_message(self, message: str, *args: Any) -> None:
        print(f"[f5tts] {self.address_string()} - {message % args}", flush=True)


if __name__ == "__main__":
    print(f"F5-TTS local service listening on http://{HOST}:{PORT}", flush=True)
    print(f"Model: {MODEL_VERSION}; loaded lazily on first synthesis", flush=True)
    ThreadingHTTPServer((HOST, PORT), F5TtsHandler).serve_forever()
