using System.Text;
using System.Text.Json;
using System.Net.Http.Headers;

namespace EpubLibrary.Services;

public sealed class KokoroTtsService : ITtsEngine
{
    private const int MaxTextLength = 20_000;
    private readonly HttpClient _httpClient;
    private readonly ILogger<KokoroTtsService> _logger;

    public string Id => "kokoro";

    public IReadOnlyList<TtsVoice> Voices { get; } =
    [
        new("kokoro:ff_siwis", "kokoro", "Siwis Kokoro", "fr-FR", "Français · Femme", "Voix française Kokoro", "Kokoro-82M"),
        new("kokoro:fr_michael", "kokoro", "Michel FR", "fr-FR", "Français · Homme", "Timbre masculin de Michael avec prononciation française", "Kokoro-82M"),
        new("kokoro:af_heart", "kokoro", "Heart", "en-US", "English US · Female", "American English, expressive", "Kokoro-82M"),
        new("kokoro:af_bella", "kokoro", "Bella", "en-US", "English US · Female", "American English, warm", "Kokoro-82M"),
        new("kokoro:af_nicole", "kokoro", "Nicole", "en-US", "English US · Female", "American English, narration", "Kokoro-82M"),
        new("kokoro:am_michael", "kokoro", "Michael", "en-US", "English US · Male", "American English, balanced", "Kokoro-82M"),
        new("kokoro:am_fenrir", "kokoro", "Fenrir", "en-US", "English US · Male", "American English, expressive", "Kokoro-82M"),
        new("kokoro:bf_emma", "kokoro", "Emma", "en-GB", "English UK · Female", "British English, narration", "Kokoro-82M"),
        new("kokoro:bm_george", "kokoro", "George", "en-GB", "English UK · Male", "British English, balanced", "Kokoro-82M"),
    ];

    public KokoroTtsService(HttpClient httpClient, IConfiguration configuration, ILogger<KokoroTtsService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(configuration["Tts:Kokoro:Url"] ?? "http://127.0.0.1:8880");
        // The first request may download the model; later paragraph requests are much faster.
        _httpClient.Timeout = TimeSpan.FromMinutes(10);
    }

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            using var healthTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            healthTimeout.CancelAfter(TimeSpan.FromSeconds(2));
            using var response = await _httpClient.GetAsync("health", healthTimeout.Token);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return false;
        }
    }

    public async Task<byte[]> SynthesizeAsync(
        string text,
        string voice,
        double speed,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text))
            throw new ArgumentException("Le texte à synthétiser est vide.", nameof(text));
        if (text.Length > MaxTextLength)
            throw new ArgumentException($"Le texte dépasse {MaxTextLength} caractères.", nameof(text));
        if (speed is < 0.5 or > 2.0)
            throw new ArgumentOutOfRangeException(nameof(speed), "La vitesse doit être comprise entre 0.5 et 2.0.");

        var localVoice = voice.StartsWith("kokoro:", StringComparison.OrdinalIgnoreCase) ? voice[7..] : voice;
        if (!Voices.Any(item => item.Id.EndsWith($":{localVoice}", StringComparison.OrdinalIgnoreCase)))
            throw new ArgumentException("Voix Kokoro non autorisée.", nameof(voice));

        try
        {
            var json = JsonSerializer.Serialize(
                new KokoroRequest(text, localVoice, speed),
                new JsonSerializerOptions(JsonSerializerDefaults.Web));
            using var content = new StringContent(json, Encoding.UTF8);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
            using var response = await _httpClient.PostAsync("synthesize", content, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var message = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new InvalidOperationException($"Kokoro a échoué ({(int)response.StatusCode}): {message}");
            }

            var audio = await response.Content.ReadAsByteArrayAsync(cancellationToken);
            if (audio.Length < 44)
                throw new InvalidOperationException("Kokoro a retourné un fichier audio invalide.");
            return audio;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogWarning(ex, "Kokoro is unavailable at {Url}", _httpClient.BaseAddress);
            throw new InvalidOperationException($"Service Kokoro indisponible: {_httpClient.BaseAddress}", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new TimeoutException("Kokoro n'a pas terminé dans le délai de 10 minutes.", ex);
        }
    }

    private sealed record KokoroRequest(string Text, string Voice, double Speed);
}
