using System.Diagnostics;

namespace EpubLibrary.Services;

public sealed class F5TtsProcessHostedService : IHostedService
{
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly ILogger<F5TtsProcessHostedService> _logger;
    private Process? _process;

    public F5TtsProcessHostedService(
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<F5TtsProcessHostedService> logger)
    {
        _environment = environment;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_configuration.GetValue("Tts:F5:AutoStart", true)) return;

        var serviceUrl = _configuration["Tts:F5:Url"] ?? "http://127.0.0.1:8881";
        if (await IsListeningAsync(serviceUrl, cancellationToken))
        {
            _logger.LogInformation("Using F5-TTS service already running at {Url}", serviceUrl);
            return;
        }

        var directory = ResolveDirectory(_configuration["Tts:F5:Directory"] ?? "assets/tts/f5tts");
        var script = Path.Combine(directory, "server.py");
        var configuredPython = _configuration["Tts:F5:Python"];
        var python = !string.IsNullOrWhiteSpace(configuredPython)
            ? ResolveFile(directory, configuredPython)
            : Path.Combine(directory, ".venv", OperatingSystem.IsWindows() ? "Scripts/python.exe" : "bin/python");

        if (!File.Exists(script) || !File.Exists(python))
        {
            _logger.LogInformation("F5-TTS auto-start skipped. Install its isolated environment in {Directory}.", directory);
            return;
        }

        _process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = python,
                WorkingDirectory = directory,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            },
            EnableRaisingEvents = true,
        };
        _process.StartInfo.ArgumentList.Add("-u");
        _process.StartInfo.ArgumentList.Add(script);
        CopySettingToEnvironment("Tts:F5:ModelName", "F5_TTS_MODEL_NAME");
        CopySettingToEnvironment("Tts:F5:ModelPath", "F5_TTS_MODEL_PATH");
        CopySettingToEnvironment("Tts:F5:VocabPath", "F5_TTS_VOCAB_PATH");
        CopySettingToEnvironment("Tts:F5:ModelVersion", "F5_TTS_MODEL_VERSION");
        CopySettingToEnvironment("Tts:F5:ModelCacheDirectory", "F5_TTS_CACHE_DIR");
        _process.OutputDataReceived += (_, args) => { if (args.Data is not null) _logger.LogInformation("F5-TTS: {Message}", args.Data); };
        _process.ErrorDataReceived += (_, args) => { if (args.Data is not null) _logger.LogWarning("F5-TTS: {Message}", args.Data); };

        try
        {
            _process.Start();
            _process.BeginOutputReadLine();
            _process.BeginErrorReadLine();
            _logger.LogInformation("Started optional F5-TTS service from {Directory}", directory);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not start optional F5-TTS service; Piper and Kokoro remain available.");
            _process.Dispose();
            _process = null;
        }
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        if (_process is null) return Task.CompletedTask;
        try
        {
            if (!_process.HasExited) _process.Kill(entireProcessTree: true);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not stop F5-TTS cleanly.");
        }
        finally
        {
            _process.Dispose();
            _process = null;
        }
        return Task.CompletedTask;
    }

    private async Task<bool> IsListeningAsync(string serviceUrl, CancellationToken cancellationToken)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            using var response = await client.GetAsync(new Uri(new Uri(serviceUrl), "health"), cancellationToken);
            return true; // A degraded response still proves that the configured service owns the port.
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return false;
        }
    }

    private void CopySettingToEnvironment(string setting, string environmentVariable)
    {
        var value = _configuration[setting];
        if (!string.IsNullOrWhiteSpace(value)) _process!.StartInfo.Environment[environmentVariable] = value;
    }

    private string ResolveDirectory(string configuredDirectory)
    {
        if (Path.IsPathRooted(configuredDirectory)) return configuredDirectory;
        var parent = Directory.GetParent(_environment.ContentRootPath)?.FullName ?? _environment.ContentRootPath;
        var candidates = new[]
        {
            Path.Combine(_environment.ContentRootPath, configuredDirectory),
            Path.Combine(parent, configuredDirectory),
            Path.Combine(AppContext.BaseDirectory, configuredDirectory),
        };
        return candidates.FirstOrDefault(path => File.Exists(Path.Combine(path, "server.py"))) ?? candidates[0];
    }

    private static string ResolveFile(string directory, string path) =>
        Path.IsPathRooted(path) ? path : Path.Combine(directory, path);
}
