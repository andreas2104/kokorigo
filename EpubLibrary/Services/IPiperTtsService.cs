namespace EpubLibrary.Services;

public interface IPiperTtsService
{
    Task<byte[]> SynthesizeAsync(string text, string voice, double speed, CancellationToken cancellationToken = default);
}
