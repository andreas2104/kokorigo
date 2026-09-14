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

## Mobile et hors ligne

L'interface est responsive : sur téléphone le lecteur occupe l'écran, la
bibliothèque et les réglages vocaux deviennent des panneaux dépliables, et
l'appui long sur le texte ouvre le menu d'accessibilité (taille, zoom, police).

L'application est installable (PWA) depuis le menu du navigateur et reste
utilisable sans réseau :

- le service worker (`epub-reader-ui/public/sw.js`) met en cache l'interface ;
  incrémenter `CACHE_NAME` à chaque mise en production pour purger l'ancien ;
- les EPUB importés sont copiés dans IndexedDB, ainsi que ceux ouverts depuis
  l'API : la bibliothèque et la position de lecture restent disponibles ;
- les imports et suppressions faits hors ligne sont rejoués sur l'API dès le
  retour du réseau ;
- la synthèse vocale dispose de deux recours sans réseau : la voix Piper
  embarquée (ci-dessous) et, à défaut, les voix du téléphone (repérées par
  « Appareil »). Piper, Kokoro et F5-TTS côté serveur restent utilisés dès que
  l'API répond.

Le service worker n'est enregistré qu'en production (`next build && next start`
ou l'image Docker), pas en `next dev`.

### Voix Piper exécutée par le téléphone

Le panneau « Lecture vocale » propose de télécharger la voix du serveur
(`fr_FR-siwis-medium`, environ 90 Mo avec son moteur). Le modèle vient de l'API
(`GET /api/v1/tts/model/<fichier>`, liste blanche des modèles Piper installés),
est enregistré dans le stockage privé du navigateur, puis la synthèse s'exécute
dans un worker WebAssembly : même voix qu'en ligne, sans requête réseau ni CDN.
Une première synthèse est lancée à l'installation pour mettre le moteur en cache
tant que la connexion est disponible.

Les binaires WebAssembly sont copiés dans `public/piper` par
`scripts/copy-piper-assets.mjs`, exécuté par `npm run dev` et `npm run build`.

Kokoro et F5-TTS restent côté serveur : leurs modèles (plusieurs centaines de Mo,
et de la diffusion pour F5) ne tiennent pas dans un navigateur de téléphone.
