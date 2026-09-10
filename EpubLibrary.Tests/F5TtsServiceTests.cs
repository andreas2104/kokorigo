using System.Net;
using System.Text;
using EpubLibrary.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using Moq.Protected;
using Xunit;

namespace EpubLibrary.Tests;

public sealed class F5TtsServiceTests
{
    [Fact]
    public async Task IdenticalRequestUsesDiskCache()
    {
        var temporaryDirectory = Path.Combine(Path.GetTempPath(), $"kokorigo-f5-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(temporaryDirectory);
        try
        {
            await File.WriteAllTextAsync(Path.Combine(temporaryDirectory, "voices.json"),
                """{"voices":[{"id":"narratrice-fr","name":"Narratrice","language":"fr-FR","character":"Femme","description":"Test","referenceAudio":"ref.wav","referenceText":"ref.txt"}]}""");

            var wav = new byte[48];
            Encoding.ASCII.GetBytes("RIFF").CopyTo(wav, 0);
            BitConverter.GetBytes(48_000).CopyTo(wav, 28);
            BitConverter.GetBytes(4).CopyTo(wav, 40);
            var requests = 0;
            var handler = new Mock<HttpMessageHandler>();
            handler.Protected()
                .Setup<Task<HttpResponseMessage>>("SendAsync", ItExpr.IsAny<HttpRequestMessage>(), ItExpr.IsAny<CancellationToken>())
                .ReturnsAsync(() =>
                {
                    requests++;
                    return new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(wav) };
                });
            var environment = new Mock<IWebHostEnvironment>();
            environment.SetupGet(item => item.ContentRootPath).Returns(temporaryDirectory);
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Tts:F5:Directory"] = temporaryDirectory,
                ["Tts:F5:CacheDirectory"] = Path.Combine(temporaryDirectory, "cache"),
            }).Build();
            var service = new F5TtsService(
                new HttpClient(handler.Object), environment.Object, configuration, Mock.Of<ILogger<F5TtsService>>());

            var first = await service.SynthesizeAsync("Bonjour", "f5tts:narratrice-fr", 1);
            var second = await service.SynthesizeAsync("Bonjour", "f5tts:narratrice-fr", 1);

            Assert.Equal(first, second);
            Assert.Equal(1, requests);
            Assert.Single(Directory.GetFiles(Path.Combine(temporaryDirectory, "cache"), "*.wav"));
        }
        finally
        {
            Directory.Delete(temporaryDirectory, recursive: true);
        }
    }
}
