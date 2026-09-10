# Kokorigo

Local EPUB reader with three text-to-speech engines:

- Piper: bundled French voice and default engine.
- Kokoro-82M: French, American English and British English voices.
- F5-TTS French: higher-quality French synthesis with a configurable reference voice.

The voice selected in the UI determines the engine. Existing requests using
the legacy `ff_siwis` voice still use Piper.

## Start

### Docker

Pour lancer l'API et l'interface derrière un seul port :

```bash
docker compose up --build -d
```

L'application est ensuite disponible sur <http://localhost:8081>. Les EPUB
sont conservés dans le volume Docker `kokorigo-library`. Les modèles et voix
Kokoro et F5-TTS téléchargés au premier usage sont conservés dans `kokorigo-models`.

Start the C# API:

```bash
dotnet run --project EpubLibrary
```

The API listens on `http://localhost:5055`, which is also the web UI default.

Start the web UI in another terminal:

```bash
cd epub-reader-ui
npm run dev
```

Piper works immediately. To enable Kokoro, follow
[`assets/tts/kokoro/README.md`](assets/tts/kokoro/README.md). Once its virtual
environment is installed, the C# API starts the local Kokoro service
automatically. Kokoro downloads its model and each selected voice on first use.

F5-TTS uses an isolated Python environment. Installation, model configuration,
CPU/GPU notes and the standalone test are documented in
[`assets/tts/f5tts/README.md`](assets/tts/f5tts/README.md).
