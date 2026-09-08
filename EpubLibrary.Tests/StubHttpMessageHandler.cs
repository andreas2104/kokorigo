using System.Net;
using System.Text;

namespace EpubLibrary.Tests;

internal sealed class StubHttpMessageHandler : HttpMessageHandler
{
    private readonly Func<HttpResponseMessage> _responseFactory;
    private readonly List<Uri> _requestedUris = new();

    public IReadOnlyList<Uri> RequestedUris => _requestedUris;

    private StubHttpMessageHandler(Func<HttpResponseMessage> responseFactory)
    {
        _responseFactory = responseFactory;
    }

    public static StubHttpMessageHandler Ok(string content, params (string Key, string Value)[] headers)
    {
        return new StubHttpMessageHandler(() =>
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(content, Encoding.UTF8)
            };
            foreach (var (key, value) in headers)
            {
                response.Headers.TryAddWithoutValidation(key, value);
            }
            return response;
        });
    }

    public static StubHttpMessageHandler Ok(byte[] bytes)
    {
        return new StubHttpMessageHandler(() => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new ByteArrayContent(bytes)
        });
    }

    public static StubHttpMessageHandler Failure(HttpStatusCode statusCode)
    {
        return new StubHttpMessageHandler(() => new HttpResponseMessage(statusCode));
    }

    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        if (request.RequestUri is not null)
        {
            _requestedUris.Add(request.RequestUri);
        }
        return Task.FromResult(_responseFactory());
    }
}