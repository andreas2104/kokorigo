# F5-TTS français

Ce service optionnel reste lié à `127.0.0.1:8881`. Il utilise le checkpoint
français `RASPIAUDIO/F5-French-MixedSpeakers-reduced` et conserve le modèle en
mémoire après la première synthèse. Le checkpoint est sous licence
CC-BY-NC-4.0 : vérifiez sa compatibilité avec votre usage.

## Installation locale (CPU)

Python 3.10 ou plus récent et FFmpeg sont requis.

```bash
cd assets/tts/f5tts
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
.venv/bin/pip install -r requirements.txt
```

Au prochain démarrage de l'API C#, le serveur Python sera lancé automatiquement.
Le checkpoint français (environ 1,35 Go) et Vocos sont téléchargés lors de la
première synthèse.

## NVIDIA CUDA

Installez d'abord les versions de `torch` et `torchaudio` correspondant à votre
version CUDA, puis `requirements.txt`. Le serveur choisit automatiquement CUDA,
XPU, MPS ou CPU. L'absence de GPU ne bloque jamais Piper ou Kokoro, mais une
génération F5-TTS sur CPU peut être très lente.

Pour construire l'image Docker avec des wheels CUDA compatibles, passez l'index
PyTorch voulu :

```bash
docker build \
  --build-arg F5_TORCH_INDEX_URL=https://download.pytorch.org/whl/cu128 \
  -t kokorigo:cuda .
```

Le lancement GPU requiert aussi NVIDIA Container Toolkit et l'option Docker
`--gpus all`.

## Configuration

Les valeurs peuvent être changées dans `appsettings.json` ou par variables
d'environnement :

```text
F5_TTS_MODEL_NAME=F5TTS_Base
F5_TTS_MODEL_PATH=hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/model_last_reduced.pt
F5_TTS_VOCAB_PATH=hf://RASPIAUDIO/F5-French-MixedSpeakers-reduced/vocab.txt
F5_TTS_MODEL_VERSION=raspiaudio-french-reduced-v1
F5_TTS_VOICES_CONFIG=/chemin/voices.json
F5_TTS_CACHE_DIR=/chemin/cache-modeles
```

Les voix sont déclarées une seule fois dans `voices.json`. Chaque entrée pointe
vers un WAV de référence et sa transcription exacte. La référence fournie sert
de démarrage local ; remplacez-la par un enregistrement humain propre de 5 à 12
secondes pour obtenir la meilleure qualité, uniquement avec le consentement du
locuteur.

## Test autonome

```bash
cd assets/tts/f5tts
.venv/bin/python -m unittest -v test_server.py
.venv/bin/python test_f5tts.py
```

Le second test télécharge le modèle au premier passage puis crée
`/tmp/kokorigo-f5tts-test.wav`.
