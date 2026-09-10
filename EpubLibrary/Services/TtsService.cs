namespace EpubLibrary.Services;

public sealed class TtsService : ITtsService
{
    private readonly IReadOnlyDictionary<string, ITtsEngine> _engines;

    public TtsService(IEnumerable<ITtsEngine> engines)
    {
        _engines = engines.ToDictionary(item => item.Id, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<IReadOnlyList<TtsVoice>> GetVoicesAsync(CancellationToken cancellationToken = default)
    {
        var results = new List<TtsVoice>();
        foreach (var engine in _engines.Values)
        {
            var available = false;
            try
            {
                available = await engine.IsAvailableAsync(cancellationToken);
            }
            catch when (!cancellationToken.IsCancellationRequested)
            {
                // A missing optional engine must not hide voices from other engines.
            }

            results.AddRange(engine.Voices.Select(voice => voice with { Available = available }));
        }

        return results;
    }

    public Task<byte[]> SynthesizeAsync(
        string text,
        string voice,
        double speed,
        string? engine = null,
        CancellationToken cancellationToken = default)
    {
        var voiceParts = voice.Split(':', 2, StringSplitOptions.TrimEntries);
        var voiceEngine = voiceParts.Length == 2 ? voiceParts[0] : null;
        var selectedEngine = string.IsNullOrWhiteSpace(engine) ? voiceEngine ?? "piper" : engine.Trim();

        if (voiceEngine is not null && !string.Equals(voiceEngine, selectedEngine, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException($"La voix {voice} n'appartient pas au moteur {selectedEngine}.", nameof(voice));

        if (!_engines.TryGetValue(selectedEngine, out var ttsEngine))
            throw new ArgumentException($"Moteur vocal inconnu: {selectedEngine}.", nameof(engine));

        return ttsEngine.SynthesizeAsync(text, voice, speed, cancellationToken);
    }
}
