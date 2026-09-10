using EpubLibrary.Services;
using Microsoft.AspNetCore.Mvc;

namespace EpubLibrary.Controllers;

[ApiController]
[Route("api/v1/voices")]
public sealed class VoicesController : ControllerBase
{
    private readonly ITtsService _tts;

    public VoicesController(ITtsService tts) => _tts = tts;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TtsVoice>>> GetAvailableVoices(CancellationToken cancellationToken)
    {
        return Ok(await _tts.GetVoicesAsync(cancellationToken));
    }
}
