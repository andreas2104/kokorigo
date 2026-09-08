using Microsoft.AspNetCore.Mvc;

namespace EpubLibrary.Controllers;

[ApiController]
[Route("api/v1/voices")]
public sealed class VoicesController : ControllerBase
{
    [HttpGet]
    public ActionResult<IReadOnlyList<VoiceDescription>> GetAvailableVoices()
    {
        return Ok(new[]
        {
            new VoiceDescription(
                "ff_siwis",
                "Siwis",
                "Femme",
                "Voix française naturelle, qualité moyenne",
                "fr_FR-siwis-medium"),
        });
    }

    public sealed record VoiceDescription(
        string Id,
        string Name,
        string Character,
        string Description,
        string Model);
}
