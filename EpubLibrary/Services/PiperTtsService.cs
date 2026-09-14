using System.Collections.Concurrent;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;

namespace EpubLibrary.Services;

public sealed class PiperTtsService : ITtsEngine
{
    private const int MaxTextLength = 20_000;
    private readonly ILogger<PiperTtsService> _logger;
    private readonly string _piperDirectory;
    private readonly string _binaryPath;
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

    public string Id => "piper";

    private static readonly IReadOnlyList<(string Id, string Model, TtsVoice Voice)> VoiceDefinitions =
    [
        ("ff_siwis", "fr_FR-siwis-medium.onnx", new("piper:ff_siwis", "piper", "Siwis", "fr-FR", "Voix française · Femme", "Voix française locale, légère et rapide", "fr_FR-siwis-medium")),
        ("fr_FR-gilles-low", "fr_FR-gilles-low.onnx", new("piper:fr_FR-gilles-low", "piper", "Gilles", "fr-FR", "Voix française · Homme", "Voix française masculine (modèle Piper Gilles)", "fr_FR-gilles-low")),
    ];

    // Le navigateur peut exécuter Piper en WebAssembly : il télécharge alors le
    // même modèle que celui utilisé par l'API, servi depuis cette machine.
    public bool TryGetModelPath(string fileName, out string path)
    {
        path = string.Empty;
        var known = VoiceDefinitions.Any(item =>
            string.Equals(item.Model, fileName, StringComparison.OrdinalIgnoreCase)
            || string.Equals($"{item.Model}.json", fileName, StringComparison.OrdinalIgnoreCase));
        if (!known)
            return false;

        var candidate = Path.Combine(_piperDirectory, fileName);
        if (!File.Exists(candidate))
            return false;

        path = candidate;
        return true;
    }

    public IReadOnlyList<TtsVoice> Voices => VoiceDefinitions
        .Where(item => File.Exists(Path.Combine(_piperDirectory, item.Model)) && File.Exists(Path.Combine(_piperDirectory, $"{item.Model}.json")))
        .Select(item => item.Voice)
        .ToArray();

    public PiperTtsService(
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<PiperTtsService> logger)
    {
        _logger = logger;
        var configuredDirectory = configuration["Tts:PiperDirectory"] ?? "assets/tts/piper";
        _piperDirectory = ResolvePiperDirectory(environment, configuredDirectory);
        _binaryPath = Path.Combine(_piperDirectory, configuration["Tts:PiperBinary"] ?? "piper");
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
        var localVoice = voice.StartsWith("piper:", StringComparison.OrdinalIgnoreCase) ? voice[6..] : voice;
        var definition = VoiceDefinitions.FirstOrDefault(item => string.Equals(item.Id, localVoice, StringComparison.OrdinalIgnoreCase));
        if (definition == default)
            throw new ArgumentException("Voix Piper non autorisée.", nameof(voice));
        var modelPath = Path.Combine(_piperDirectory, definition.Model);

        EnsureAssets(modelPath);

        var cacheDirectory = Path.Combine(_piperDirectory, "cache");
        Directory.CreateDirectory(cacheDirectory);
        var cacheKey = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"piper:{voice}:{speed}:{text}"))).ToLowerInvariant();
        var cachedPath = Path.Combine(cacheDirectory, $"{cacheKey}.wav");
        if (File.Exists(cachedPath))
            return await File.ReadAllBytesAsync(cachedPath, cancellationToken);

        var gate = _locks.GetOrAdd(cacheKey, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (File.Exists(cachedPath))
                return await File.ReadAllBytesAsync(cachedPath, cancellationToken);

            var temporaryPath = Path.Combine(cacheDirectory, $"{cacheKey}.{Guid.NewGuid():N}.tmp.wav");
            try
            {
                var stopwatch = Stopwatch.StartNew();
                await RunPiperAsync(text, speed, temporaryPath, modelPath, cancellationToken);
                var audio = await File.ReadAllBytesAsync(temporaryPath, cancellationToken);
                File.Move(temporaryPath, cachedPath);
                stopwatch.Stop();
                _logger.LogInformation("Piper generated {Bytes} bytes in {ElapsedMs} ms", audio.Length, stopwatch.ElapsedMilliseconds);
                return audio;
            }
            finally
            {
                if (File.Exists(temporaryPath))
                    File.Delete(temporaryPath);
            }
        }
        finally
        {
            gate.Release();
        }
    }

    public Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        var available = File.Exists(_binaryPath)
            && Voices.Count > 0
            && (OperatingSystem.IsWindows() || new FileInfo(_binaryPath).UnixFileMode.HasFlag(UnixFileMode.UserExecute));
        return Task.FromResult(available);
    }

    private async Task RunPiperAsync(string text, double speed, string outputPath, string modelPath, CancellationToken cancellationToken)
    {
        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = _binaryPath,
                WorkingDirectory = _piperDirectory,
                UseShellExecute = false,
                RedirectStandardInput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                StandardInputEncoding = Encoding.UTF8,
                StandardErrorEncoding = Encoding.UTF8,
            }
        };
        process.StartInfo.ArgumentList.Add("--model");
        process.StartInfo.ArgumentList.Add(modelPath);
        process.StartInfo.ArgumentList.Add("--output_file");
        process.StartInfo.ArgumentList.Add(outputPath);
        process.StartInfo.ArgumentList.Add("--length_scale");
        process.StartInfo.ArgumentList.Add((1.0 / speed).ToString("0.###", System.Globalization.CultureInfo.InvariantCulture));
        process.StartInfo.Environment["LD_LIBRARY_PATH"] = _piperDirectory;

        try
        {
            if (!process.Start())
                throw new InvalidOperationException("Impossible de démarrer Piper.");
        }
        catch (Exception ex) when (ex is InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            throw new InvalidOperationException($"Binaire Piper introuvable ou non exécutable: {_binaryPath}", ex);
        }

        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
        await process.StandardInput.WriteLineAsync(text.AsMemory(), cancellationToken);
        await process.StandardInput.FlushAsync(cancellationToken);
        process.StandardInput.Close();

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(60));
        try
        {
            await process.WaitForExitAsync(timeout.Token);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            TryKill(process);
            throw new TimeoutException("Piper n'a pas terminé dans le délai de 60 secondes.");
        }
        catch (OperationCanceledException)
        {
            TryKill(process);
            throw;
        }

        var stderr = await stderrTask;
        if (process.ExitCode != 0 || !File.Exists(outputPath))
            throw new InvalidOperationException($"Piper a échoué ({process.ExitCode}): {stderr.Trim()}");
    }

    private void EnsureAssets(string modelPath)
    {
        if (!File.Exists(_binaryPath))
            throw new FileNotFoundException($"Le binaire Piper est introuvable: {_binaryPath}", _binaryPath);
        if (!File.Exists(modelPath) || !File.Exists($"{modelPath}.json"))
            throw new FileNotFoundException($"Le modèle Piper ou son fichier .onnx.json est introuvable dans {_piperDirectory}.", modelPath);
        if (!OperatingSystem.IsWindows() && !new FileInfo(_binaryPath).UnixFileMode.HasFlag(UnixFileMode.UserExecute))
            throw new InvalidOperationException($"Le binaire Piper n'est pas exécutable: {_binaryPath} (chmod +x requis).");
    }

    private static string ResolvePiperDirectory(IWebHostEnvironment environment, string configuredDirectory)
    {
        if (Path.IsPathRooted(configuredDirectory))
            return configuredDirectory;

        var candidates = new[]
        {
            Path.Combine(environment.ContentRootPath, configuredDirectory),
            Path.Combine(AppContext.BaseDirectory, configuredDirectory),
            Path.Combine(Directory.GetParent(environment.ContentRootPath)?.FullName ?? environment.ContentRootPath, configuredDirectory),
        };
        return candidates.FirstOrDefault(path => File.Exists(Path.Combine(path, "piper"))) ?? candidates[0];
    }

    private static void TryKill(Process process)
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { /* best effort */ }
    }
}
