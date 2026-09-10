using EpubLibrary.Services;
using Microsoft.AspNetCore.Mvc;

namespace EpubLibrary.Controllers;

[ApiController]
[Route("api/v1/tts")]
public sealed class TtsController : ControllerBase
{
    private readonly ITtsService _tts;

    public TtsController(ITtsService tts) => _tts = tts;

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

    public sealed record TtsRequest(string Text, string Voice = "ff_siwis", double Speed = 1.0, string? Engine = null);
}
