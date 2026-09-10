#!/usr/bin/env python3
"""Generate one French WAV without starting the .NET or Next.js applications."""

from __future__ import annotations

import argparse
import tempfile
from pathlib import Path

from server import synthesize


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", default="narratrice-fr")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or Path(tempfile.gettempdir()) / "kokorigo-f5tts-test.wav"
    wav, metrics = synthesize(
        "Bonjour, ceci est un test de synthèse vocale française pour la lecture de livres.",
        args.voice,
        1.0,
    )
    output.write_bytes(wav)
    print(f"WAV: {output}")
    print(f"Device: {metrics['device']}; audio: {metrics['audioSeconds']:.2f}s; RTF: {metrics['rtf']:.3f}")


if __name__ == "__main__":
    main()
