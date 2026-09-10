# Kokoro local service

Kokoro is optional. Piper remains available when this service is stopped.

## Install

Python 3.12 and `espeak-ng` are required. From this directory:

```bash
python3 -m venv .venv
.venv/bin/pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
```

Installing the CPU build of PyTorch first prevents pip from downloading the
much larger CUDA runtime on machines that do not need it. The Python packages
include an `espeak-ng` loader used for phonemization.

## Start

```bash
.venv/bin/python server.py
```

Starting the C# API also starts this command automatically when `.venv` is
installed. Set `Tts:Kokoro:AutoStart` to `false` to manage it separately.

The service listens only on `127.0.0.1:8880`. Kokoro downloads its model and a
voice file from Hugging Face on their first use, then uses the local cache.

Available languages in Kokorigo:

- French: `ff_siwis`, `fr_michael` (Michael's male timbre with French phonemization)
- American English: `af_heart`, `af_bella`, `af_nicole`, `am_michael`, `am_fenrir`
- British English: `bf_emma`, `bm_george`

The C# API URL can be changed with `Tts:Kokoro:Url` in `appsettings.json`.
