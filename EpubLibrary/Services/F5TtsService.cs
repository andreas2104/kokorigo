using System.Collections.Concurrent;
using System.Diagnostics;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace EpubLibrary.Services;

public sealed class F5TtsService : ITtsEngine
{
    private const int MaxTextLength = 5_000;
    private readonly HttpClient _httpClient;
    private readonly ILogger<F5TtsService> _logger;
    private readonly IReadOnlyDictionary<string, VoiceDefinition> _voiceDefinitions;
    private readonly string _cacheDirectory;
    private readonly string _modelVersion;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public string Id => "f5tts";
    public IReadOnlyList<TtsVoice> Voices { get; }

    public F5TtsService(
        HttpClient httpClient,
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<F5TtsService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _httpClient.BaseAddress = new Uri(configuration["Tts:F5:Url"] ?? "http://127.0.0.1:8881");
        _httpClient.Timeout = TimeSpan.FromMinutes(configuration.GetValue("Tts:F5:TimeoutMinutes", 20));

        var directory = ResolveDirectory(environment, configuration["Tts:F5:Directory"] ?? "assets/tts/f5tts");
        _cacheDirectory = ResolvePath(environment, configuration["Tts:F5:CacheDirectory"] ?? Path.Combine(directory, "cache"));
        _modelVersion = configuration["Tts:F5:ModelVersion"] ?? "raspiaudio-french-reduced-v1";
        _voiceDefinitions = LoadVoiceDefinitions(Path.Combine(directory, "voices.json"));
        Voices = _voiceDefinitions.Values.Select(definition => new TtsVoice(
            $"f5tts:{definition.Id}",
            Id,
            definition.Name,
            definition.Language,
            definition.Character,
            definition.Description,
            _modelVersion)).ToArray();
    }

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        if (Voices.Count == 0)
            return false;
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(3));
            using var response = await _httpClient.GetAsync("health", timeout.Token);
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
            throw new ArgumentException($"Le texte dépasse {MaxTextLength} caractères pour F5-TTS.", nameof(text));
        if (speed is < 0.5 or > 2.0)
            throw new ArgumentOutOfRangeException(nameof(speed), "La vitesse doit être comprise entre 0.5 et 2.0.");

        var localVoice = voice.StartsWith("f5tts:", StringComparison.OrdinalIgnoreCase) ? voice[6..] : voice;
        if (!_voiceDefinitions.TryGetValue(localVoice, out var definition))
            throw new ArgumentException("Voix F5-TTS non autorisée.", nameof(voice));

        Directory.CreateDirectory(_cacheDirectory);
        var cacheKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
            $"f5tts:{_modelVersion}:{localVoice}:{speed:0.###}:{text}"))).ToLowerInvariant();
        var cachedPath = Path.Combine(_cacheDirectory, $"{cacheKey}.wav");
        if (File.Exists(cachedPath))
        {
            var cached = await File.ReadAllBytesAsync(cachedPath, cancellationToken);
            _logger.LogInformation(
                "F5-TTS cache HIT: Voice={Voice} Model={Model} TextLength={TextLength} AudioSeconds={AudioSeconds:F2}",
                localVoice, _modelVersion, text.Length, GetWavDuration(cached));
            return cached;
        }

        var gate = _locks.GetOrAdd(cacheKey, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (File.Exists(cachedPath))
                return await File.ReadAllBytesAsync(cachedPath, cancellationToken);

            var stopwatch = Stopwatch.StartNew();
            var request = new F5Request(text, localVoice, speed, definition.Language);
            using var content = new StringContent(
                JsonSerializer.Serialize(request, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
                Encoding.UTF8);
            content.Headers.ContentType = new MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };

            try
            {
                using var response = await _httpClient.PostAsync("synthesize", content, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    var message = await response.Content.ReadAsStringAsync(cancellationToken);
                    throw new InvalidOperationException($"F5-TTS a échoué ({(int)response.StatusCode}): {message}");
                }

                var audio = await response.Content.ReadAsByteArrayAsync(cancellationToken);
                if (audio.Length < 44 || !audio.AsSpan(0, 4).SequenceEqual("RIFF"u8))
                    throw new InvalidOperationException("F5-TTS a retourné un fichier audio invalide.");

                var temporaryPath = Path.Combine(_cacheDirectory, $"{cacheKey}.{Guid.NewGuid():N}.tmp.wav");
                try
                {
                    await File.WriteAllBytesAsync(temporaryPath, audio, cancellationToken);
                    File.Move(temporaryPath, cachedPath);
                }
                finally
                {
                    if (File.Exists(temporaryPath)) File.Delete(temporaryPath);
                }

                stopwatch.Stop();
                var audioSeconds = GetWavDuration(audio);
                _logger.LogInformation(
                    "F5-TTS cache MISS: Voice={Voice} Model={Model} TextLength={TextLength} GenerationSeconds={GenerationSeconds:F2} AudioSeconds={AudioSeconds:F2} RTF={Rtf:F3}",
                    localVoice, _modelVersion, text.Length, stopwatch.Elapsed.TotalSeconds, audioSeconds,
                    audioSeconds > 0 ? stopwatch.Elapsed.TotalSeconds / audioSeconds : 0);
                return audio;
            }
            catch (HttpRequestException ex)
            {
                throw new InvalidOperationException($"Service F5-TTS indisponible: {_httpClient.BaseAddress}", ex);
            }
            catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                throw new TimeoutException("F5-TTS n'a pas terminé dans le délai configuré.", ex);
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private static IReadOnlyDictionary<string, VoiceDefinition> LoadVoiceDefinitions(string path)
    {
        if (!File.Exists(path)) return new Dictionary<string, VoiceDefinition>();
        var configuration = JsonSerializer.Deserialize<VoicesConfiguration>(
            File.ReadAllText(path),
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        return (configuration?.Voices ?? [])
            .Where(voice => !string.IsNullOrWhiteSpace(voice.Id))
            .ToDictionary(voice => voice.Id, StringComparer.OrdinalIgnoreCase);
    }

    private static double GetWavDuration(byte[] audio)
    {
        if (audio.Length < 44) return 0;
        var byteRate = BitConverter.ToInt32(audio, 28);
        var dataLength = BitConverter.ToInt32(audio, 40);
        return byteRate > 0 && dataLength > 0 ? (double)dataLength / byteRate : 0;
    }

    private static string ResolveDirectory(IWebHostEnvironment environment, string configuredDirectory)
    {
        if (Path.IsPathRooted(configuredDirectory)) return configuredDirectory;
        var parent = Directory.GetParent(environment.ContentRootPath)?.FullName ?? environment.ContentRootPath;
        var candidates = new[]
        {
            Path.Combine(environment.ContentRootPath, configuredDirectory),
            Path.Combine(parent, configuredDirectory),
            Path.Combine(AppContext.BaseDirectory, configuredDirectory),
        };
        return candidates.FirstOrDefault(path => File.Exists(Path.Combine(path, "voices.json"))) ?? candidates[0];
    }

    private static string ResolvePath(IWebHostEnvironment environment, string path) =>
        Path.IsPathRooted(path) ? path : Path.Combine(environment.ContentRootPath, path);

    private sealed record F5Request(string Text, string Voice, double Speed, string Language);
    private sealed record VoicesConfiguration(IReadOnlyList<VoiceDefinition> Voices);
    private sealed record VoiceDefinition(
        string Id,
        string Name,
        string Language,
        string Character,
        string Description,
        string ReferenceAudio,
        string ReferenceText);
}
