using System.Text.Json;
using EpubLibrary.Models;

namespace EpubLibrary.Services;

public sealed class MyLibraryService : IMyLibraryService
{
    private const string IndexFileName = "index.json";
    private const string BooksDirectoryName = "books";

    private readonly ILogger<MyLibraryService> _logger;
    private readonly string _rootPath;
    private readonly string _booksPath;
    private readonly string _indexPath;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public MyLibraryService(
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<MyLibraryService> logger)
    {
        _logger = logger;

        var configuredPath = configuration["MyLibrary:Path"];
        _rootPath = string.IsNullOrWhiteSpace(configuredPath)
            ? Path.Combine(environment.ContentRootPath, "library")
            : Path.Combine(environment.ContentRootPath, configuredPath);

        _booksPath = Path.Combine(_rootPath, BooksDirectoryName);
        _indexPath = Path.Combine(_rootPath, IndexFileName);

        Directory.CreateDirectory(_booksPath);
    }

    public List<MyLibraryBook> GetAll()
    {
        return LoadIndex();
    }

    public async Task<MyLibraryBook> AddAsync(Stream content, string fileName, CancellationToken cancellationToken = default)
    {
        var storedFileName = $"{Guid.NewGuid():N}.epub";
        var targetPath = Path.Combine(_booksPath, storedFileName);

        try
        {
            await using (var fileStream = new FileStream(targetPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                await content.CopyToAsync(fileStream, cancellationToken);

            await _gate.WaitAsync(cancellationToken);
            try
            {
                var books = LoadIndex();

                var book = new MyLibraryBook
                {
                    Id = books.Count > 0 ? books.Max(b => b.Id) + 1 : 1,
                    Title = Path.GetFileNameWithoutExtension(fileName),
                    Author = string.Empty,
                    CoverUrl = string.Empty,
                    SourceUrl = string.Empty,
                    FileName = storedFileName,
                    AddedAt = DateTime.UtcNow
                };

                books.Add(book);
                SaveIndex(books);

                _logger.LogInformation("Added book {Title} ({Id}) to my library", book.Title, book.Id);
                return book;
            }
            finally
            {
                _gate.Release();
            }
        }
        catch (Exception ex)
        {
            if (File.Exists(targetPath))
                File.Delete(targetPath);

            _logger.LogError(ex, "Failed to store uploaded epub {FileName}", fileName);
            throw new InvalidOperationException($"Failed to store EPUB: {ex.Message}", ex);
        }
    }

    public async Task<bool> RemoveAsync(int id)
    {
        await _gate.WaitAsync();
        try
        {
            var books = LoadIndex();
            var book = books.FirstOrDefault(b => b.Id == id);
            if (book is null)
                return false;

            books.Remove(book);
            SaveIndex(books);

            var path = Path.Combine(_booksPath, book.FileName);
            if (File.Exists(path))
                File.Delete(path);

            _logger.LogInformation("Removed book {Title} ({Id}) from my library", book.Title, book.Id);
            return true;
        }
        finally
        {
            _gate.Release();
        }
    }

    public (Stream Stream, string FileName)? GetFile(int id)
    {
        var book = LoadIndex().FirstOrDefault(b => b.Id == id);
        if (book is null)
            return null;

        var path = Path.Combine(_booksPath, book.FileName);
        if (!File.Exists(path))
            return null;

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, $"{Slug(book.Title)}.epub");
    }

    private List<MyLibraryBook> LoadIndex()
    {
        if (!File.Exists(_indexPath))
            return new List<MyLibraryBook>();

        try
        {
            var json = File.ReadAllText(_indexPath);
            return JsonSerializer.Deserialize<List<MyLibraryBook>>(json) ?? new List<MyLibraryBook>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read library index");
            return new List<MyLibraryBook>();
        }
    }

    private void SaveIndex(List<MyLibraryBook> books)
    {
        var json = JsonSerializer.Serialize(books, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_indexPath, json);
    }

    private static string Slug(string value)
    {
        var normalized = new string(value
            .Normalize(System.Text.NormalizationForm.FormD)
            .Where(c => char.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .ToArray());

        var parts = normalized
            .Split(new[] { ' ', '-', '_', '.', ',', '\'', '(', ')' }, StringSplitOptions.RemoveEmptyEntries)
            .Where(part => part.Any(char.IsLetterOrDigit));

        return string.Join("-", parts).ToLowerInvariant();
    }
}
