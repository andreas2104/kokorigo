using EpubLibrary.Services;
using Xunit;

namespace EpubLibrary.Tests;

public sealed class TtsServiceTests
{
    [Fact]
    public async Task LegacyVoiceUsesPiperByDefault()
    {
        var piper = new FakeEngine("piper", "piper:ff_siwis");
        var kokoro = new FakeEngine("kokoro", "kokoro:af_heart");
        var service = new TtsService([piper, kokoro]);

        await service.SynthesizeAsync("Bonjour", "ff_siwis", 1);

        Assert.Equal(1, piper.Calls);
        Assert.Equal(0, kokoro.Calls);
    }

    [Fact]
    public async Task NamespacedEnglishVoiceUsesKokoro()
    {
        var piper = new FakeEngine("piper", "piper:ff_siwis");
        var kokoro = new FakeEngine("kokoro", "kokoro:af_heart");
        var service = new TtsService([piper, kokoro]);

        await service.SynthesizeAsync("Hello", "kokoro:af_heart", 1);

        Assert.Equal(0, piper.Calls);
        Assert.Equal(1, kokoro.Calls);
    }

    [Fact]
    public async Task NamespacedFrenchVoiceUsesF5Tts()
    {
        var piper = new FakeEngine("piper", "piper:ff_siwis");
        var kokoro = new FakeEngine("kokoro", "kokoro:ff_siwis");
        var f5 = new FakeEngine("f5tts", "f5tts:narratrice-fr");
        var service = new TtsService([piper, kokoro, f5]);

        await service.SynthesizeAsync("Bonjour", "f5tts:narratrice-fr", 1);

        Assert.Equal(0, piper.Calls);
        Assert.Equal(0, kokoro.Calls);
        Assert.Equal(1, f5.Calls);
    }

    [Fact]
    public async Task VoiceCannotBeSentToAnotherEngine()
    {
        var service = new TtsService([
            new FakeEngine("piper", "piper:ff_siwis"),
            new FakeEngine("kokoro", "kokoro:af_heart"),
        ]);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            service.SynthesizeAsync("Hello", "kokoro:af_heart", 1, "piper"));
    }

    [Fact]
    public async Task UnavailableKokoroDoesNotHidePiperVoices()
    {
        var piper = new FakeEngine("piper", "piper:ff_siwis", available: true);
        var kokoro = new FakeEngine("kokoro", "kokoro:af_heart", available: false);
        var service = new TtsService([piper, kokoro]);

        var voices = await service.GetVoicesAsync();

        Assert.True(voices.Single(voice => voice.Engine == "piper").Available);
        Assert.False(voices.Single(voice => voice.Engine == "kokoro").Available);
    }

    private sealed class FakeEngine(string id, string voiceId, bool available = true) : ITtsEngine
    {
        public string Id => id;
        public int Calls { get; private set; }
        public IReadOnlyList<TtsVoice> Voices { get; } =
            [new(voiceId, id, voiceId, "test", "test", "test", "test")];

        public Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default) =>
            Task.FromResult(available);

        public Task<byte[]> SynthesizeAsync(string text, string voice, double speed, CancellationToken cancellationToken = default)
        {
            Calls++;
            return Task.FromResult(new byte[44]);
        }
    }
}
