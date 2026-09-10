namespace EpubLibrary.Services;

public interface ITtsService
{
    Task<IReadOnlyList<TtsVoice>> GetVoicesAsync(CancellationToken cancellationToken = default);

    Task<byte[]> SynthesizeAsync(
        string text,
        string voice,
        double speed,
        string? engine = null,
        CancellationToken cancellationToken = default);
}
