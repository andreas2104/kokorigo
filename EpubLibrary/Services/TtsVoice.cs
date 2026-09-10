namespace EpubLibrary.Services;

public sealed record TtsVoice(
    string Id,
    string Engine,
    string Name,
    string Language,
    string Character,
    string Description,
    string Model,
    bool Available = true);
