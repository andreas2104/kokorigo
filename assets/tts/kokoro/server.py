#!/usr/bin/env python3
"""Small local HTTP bridge for Kokoro-82M.

The model is loaded lazily and then kept in memory so consecutive EPUB
paragraphs do not pay the model startup cost.
"""

from __future__ import annotations

import io
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

import numpy as np
import soundfile as sf
from kokoro import KPipeline


HOST = "127.0.0.1"
PORT = 8880
MAX_TEXT_LENGTH = 20_000
VOICE_CONFIGS = {
    "ff_siwis": ("f", "ff_siwis"),
    # Kokoro has no native French male voice. This alias combines Michael's
    # male timbre with the French G2P pipeline so French text is pronounced
    # with French phonemes instead of American-English ones.
    "fr_michael": ("f", "am_michael"),
    "af_heart": ("a", "af_heart"),
    "af_bella": ("a", "af_bella"),
    "af_nicole": ("a", "af_nicole"),
    "am_michael": ("a", "am_michael"),
    "am_fenrir": ("a", "am_fenrir"),
    "bf_emma": ("b", "bf_emma"),
    "bm_george": ("b", "bm_george"),
}

_pipelines: dict[str, KPipeline] = {}
_pipeline_lock = threading.Lock()


def synthesize(text: str, voice: str, speed: float) -> bytes:
    voice_config = VOICE_CONFIGS.get(voice)
    if voice_config is None:
        raise ValueError(f"Unsupported Kokoro voice: {voice}")
    language, model_voice = voice_config

    # KPipeline and the underlying model are shared; serialize inference to
    # avoid concurrent access while the UI prefetches the next paragraph.
    with _pipeline_lock:
        pipeline = _pipelines.get(language)
        if pipeline is None:
            pipeline = KPipeline(lang_code=language)
            _pipelines[language] = pipeline
        chunks = [audio for _, _, audio in pipeline(text, voice=model_voice, speed=speed)]

    if not chunks:
        raise RuntimeError("Kokoro generated no audio")

    audio = np.concatenate(chunks)
    output = io.BytesIO()
    sf.write(output, audio, 24_000, format="WAV", subtype="PCM_16")
    return output.getvalue()


class KokoroHandler(BaseHTTPRequestHandler):
    server_version = "KokorigoKokoro/1.0"

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path.rstrip("/") != "/health":
            self.send_error(404)
            return
        self.send_json(200, {"status": "ok", "loadedLanguages": sorted(_pipelines)})

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path.rstrip("/") != "/synthesize":
            self.send_error(404)
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 100_000:
                raise ValueError("Invalid request size")
            payload: dict[str, Any] = json.loads(self.rfile.read(content_length))
            text = str(payload.get("text", "")).strip()
            voice = str(payload.get("voice", "")).strip()
            speed = float(payload.get("speed", 1.0))
            if not text:
                raise ValueError("Text is required")
            if len(text) > MAX_TEXT_LENGTH:
                raise ValueError(f"Text exceeds {MAX_TEXT_LENGTH} characters")
            if not 0.5 <= speed <= 2.0:
                raise ValueError("Speed must be between 0.5 and 2.0")

            audio = synthesize(text, voice, speed)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except (BrokenPipeError, ConnectionResetError):
            # The first model download can outlive a client timeout. The model
            # remains loaded and the next request can still complete normally.
            return
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:  # Keep the bridge alive and report inference errors.
            self.send_json(500, {"error": str(error)})

    def send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def log_message(self, message: str, *args: Any) -> None:
        print(f"[kokoro] {self.address_string()} - {message % args}")


if __name__ == "__main__":
    print(f"Kokoro local service listening on http://{HOST}:{PORT}")
    print("The model and selected voice are downloaded on first synthesis.")
    ThreadingHTTPServer((HOST, PORT), KokoroHandler).serve_forever()
