# Piper TTS — voix française

Le dossier contient le build Linux amd64 officiel Piper `2023.11.14-2` et la
voix `fr_FR-siwis-medium`.

- Piper : projet et binaire sous licence MIT.
- Voix : le dépôt `rhasspy/piper-voices` est MIT ; le MODEL_CARD de Siwis
  indique que le corpus d'entraînement est CC-BY 4.0.
- Conserver `fr_FR-siwis-MODEL_CARD` et l'attribution CC-BY 4.0 lors de la
  redistribution.

Le binaire est appelé par ASP.NET avec son chemin local et ses bibliothèques
embarquées (`LD_LIBRARY_PATH`). Il ne doit pas être installé dans le PATH.
