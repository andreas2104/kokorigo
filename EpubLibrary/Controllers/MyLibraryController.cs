using EpubLibrary.Models;
using EpubLibrary.Services;
using Microsoft.AspNetCore.Mvc;

namespace EpubLibrary.Controllers;

[ApiController]
[Route("api/my-library")]
public sealed class MyLibraryController : ControllerBase
{
    private readonly IMyLibraryService _library;

    public MyLibraryController(IMyLibraryService library)
    {
        _library = library;
    }

    [HttpGet]
    public ActionResult<List<MyLibraryBook>> GetAll()
    {
        return Ok(_library.GetAll());
    }

    [HttpGet("file/{id:int}")]
    public IActionResult GetFile(int id)
    {
        var file = _library.GetFile(id);
        if (file is null)
            return NotFound();

        return File(file.Value.Stream, "application/epub+zip", file.Value.FileName);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(100_000_000)]
    public async Task<ActionResult<MyLibraryBook>> Upload(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return BadRequest("Un fichier EPUB est requis.");

        if (!Path.GetExtension(file.FileName).Equals(".epub", StringComparison.OrdinalIgnoreCase))
            return BadRequest("Seuls les fichiers EPUB sont acceptés.");

        try
        {
            await using var stream = file.OpenReadStream();
            var book = await _library.AddAsync(stream, Path.GetFileName(file.FileName), cancellationToken);
            return CreatedAtAction(nameof(GetAll), new { id = book.Id }, book);
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Remove(int id)
    {
        var removed = await _library.RemoveAsync(id);
        return removed ? NoContent() : NotFound();
    }
}
