using EpubLibrary.Services;
using Microsoft.AspNetCore.Mvc;

namespace EpubLibrary.Controllers;

[ApiController]
[Route("api/v1/tts")]
public sealed class TtsController : ControllerBase
{
    private readonly ITtsService _tts;
    private readonly PiperTtsService _piper;

    public TtsController(ITtsService tts, PiperTtsService piper)
    {
        _tts = tts;
        _piper = piper;
    }

    [HttpPost]
    public async Task<IActionResult> Synthesize([FromBody] TtsRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var audio = await _tts.SynthesizeAsync(request.Text, request.Voice, request.Speed, request.Engine, cancellationToken);
            return File(audio, "audio/wav", "speech.wav");
        }
        catch (FileNotFoundException ex) { return StatusCode(503, ex.Message); }
        catch (ArgumentOutOfRangeException ex) { return BadRequest(ex.Message); }
        catch (ArgumentException ex) { return BadRequest(ex.Message); }
        catch (TimeoutException ex) { return StatusCode(504, ex.Message); }
        catch (InvalidOperationException ex) { return StatusCode(503, ex.Message); }
    }

    // Modèle Piper téléchargé une fois par le navigateur pour la synthèse hors ligne.
    [HttpGet("model/{fileName}")]
    public IActionResult Model(string fileName)
    {
        if (!_piper.TryGetModelPath(fileName, out var path))
            return NotFound();

        var contentType = fileName.EndsWith(".json", StringComparison.OrdinalIgnoreCase)
            ? "application/json"
            : "application/octet-stream";
        return PhysicalFile(path, contentType, enableRangeProcessing: true);
    }

    public sealed record TtsRequest(string Text, string Voice = "ff_siwis", double Speed = 1.0, string? Engine = null);
}
