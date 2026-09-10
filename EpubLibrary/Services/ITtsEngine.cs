namespace EpubLibrary.Services;

public interface ITtsEngine
{
    string Id { get; }
    IReadOnlyList<TtsVoice> Voices { get; }

    Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default);

    Task<byte[]> SynthesizeAsync(
        string text,
        string voice,
        double speed,
        CancellationToken cancellationToken = default);
}
