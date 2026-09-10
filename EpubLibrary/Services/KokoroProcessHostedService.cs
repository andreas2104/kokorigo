using System.Diagnostics;

namespace EpubLibrary.Services;

public sealed class KokoroProcessHostedService : IHostedService
{
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly ILogger<KokoroProcessHostedService> _logger;
    private Process? _process;

    public KokoroProcessHostedService(
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<KokoroProcessHostedService> logger)
    {
        _environment = environment;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_configuration.GetValue("Tts:Kokoro:AutoStart", true))
            return;

        var serviceUrl = _configuration["Tts:Kokoro:Url"] ?? "http://127.0.0.1:8880";
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
            using var response = await client.GetAsync(new Uri(new Uri(serviceUrl), "health"), cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Using Kokoro service already running at {Url}", serviceUrl);
                return;
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            // No existing service: try to start the project-local bridge below.
        }

        var directory = ResolveDirectory(_configuration["Tts:Kokoro:Directory"] ?? "assets/tts/kokoro");
        var script = Path.Combine(directory, "server.py");
        var configuredPython = _configuration["Tts:Kokoro:Python"];
        var python = !string.IsNullOrWhiteSpace(configuredPython)
            ? ResolveFile(directory, configuredPython)
            : Path.Combine(directory, ".venv", OperatingSystem.IsWindows() ? "Scripts/python.exe" : "bin/python");

        if (!File.Exists(script) || !File.Exists(python))
        {
            _logger.LogInformation(
                "Kokoro auto-start skipped. Install its optional environment in {Directory}; Piper remains available.",
                directory);
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
        _process.OutputDataReceived += (_, args) => { if (args.Data is not null) _logger.LogInformation("Kokoro: {Message}", args.Data); };
        _process.ErrorDataReceived += (_, args) => { if (args.Data is not null) _logger.LogWarning("Kokoro: {Message}", args.Data); };

        try
        {
            _process.Start();
            _process.BeginOutputReadLine();
            _process.BeginErrorReadLine();
            _logger.LogInformation("Started optional Kokoro service from {Directory}", directory);
            await WaitUntilHealthyAsync(serviceUrl, _process, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not start optional Kokoro service; Piper remains available.");
            _process.Dispose();
            _process = null;
        }

    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        if (_process is null)
            return Task.CompletedTask;
        try
        {
            if (!_process.HasExited)
                _process.Kill(entireProcessTree: true);
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not stop Kokoro process cleanly.");
        }
        finally
        {
            _process.Dispose();
            _process = null;
        }
        return Task.CompletedTask;
    }

    private string ResolveDirectory(string configuredDirectory)
    {
        if (Path.IsPathRooted(configuredDirectory))
            return configuredDirectory;

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

    private async Task WaitUntilHealthyAsync(string serviceUrl, Process process, CancellationToken cancellationToken)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var healthUrl = new Uri(new Uri(serviceUrl), "health");
        var deadline = DateTime.UtcNow.AddSeconds(60);

        while (DateTime.UtcNow < deadline && !process.HasExited)
        {
            try
            {
                using var response = await client.GetAsync(healthUrl, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Kokoro service is ready at {Url}", serviceUrl);
                    return;
                }
            }
            catch (HttpRequestException)
            {
                // Python and Torch are still starting.
            }
            catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                // The short health-check timeout elapsed; retry below.
            }

            await Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken);
        }

        if (process.HasExited)
            _logger.LogWarning("Kokoro exited during startup with code {ExitCode}", process.ExitCode);
        else
            _logger.LogWarning("Kokoro did not become ready within 60 seconds; the API will continue with Piper.");
    }
}
