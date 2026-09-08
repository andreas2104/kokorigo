namespace EpubLibrary.Models;

public sealed class MyLibraryBook
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string CoverUrl { get; set; } = string.Empty;
    public string SourceUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public DateTime AddedAt { get; set; }
}