using EpubLibrary.Models;

namespace EpubLibrary.Services;

public interface IMyLibraryService
{
    List<MyLibraryBook> GetAll();

    Task<MyLibraryBook> AddAsync(Stream content, string fileName, CancellationToken cancellationToken = default);

    Task<bool> RemoveAsync(int id);

    (Stream Stream, string FileName)? GetFile(int id);
}
