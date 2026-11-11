using System.Net;
using LeLøgin.Core.Api.Assets;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace LeLøgin.Tests.Api.Assets;

public sealed class AssetUploadHttpTests
{
    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Upload_Rejects_An_Oversized_Request_Before_Reading_The_Whole_Body(bool chunked, bool oversizedFile)
    {
        using var fixture = new UploadTestContext();
        await using var app = CreateApp(fixture);
        long bytesRead = 0;
        app.Use(async (context, next) =>
        {
            context.Request.Body = new CountedRequestStream(context.Request.Body, count => bytesRead += count);
            await next(context);
        });
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var (bytes, contentType) = await CreateMultipartAsync(
            new byte[10 * 1024 * 1024 + (oversizedFile ? 32 * 1024 : 0)],
            oversizedFile ? string.Empty : new string('a', 128 * 1024));
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);
        var responseBody = await response.Content.ReadAsStringAsync();

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, $"{response.StatusCode}: {responseBody}");
        Assert.Contains(oversizedFile ? "Multipart body length limit" : "Request body too large", responseBody, StringComparison.OrdinalIgnoreCase);
        Assert.True(bytesRead < bytes.Length, $"Read {bytesRead} of {bytes.Length} bytes.");
        Assert.Empty(await fixture.Store.GetAllAssetsAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Bounds_An_Oversized_Body_Already_Being_Sent(bool chunked)
    {
        using var fixture = new UploadTestContext();
        await using var app = CreateApp(fixture);
        long bytesRead = 0;
        var completed = new TaskCompletionSource<int>();
        app.Use(async (context, next) =>
        {
            context.Request.Body = new CountedRequestStream(context.Request.Body, count => bytesRead += count);
            await next(context);
            completed.TrySetResult(context.Response.StatusCode);
        });
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var (bytes, contentType) = await CreateMultipartAsync(new byte[10 * 1024 * 1024], new string('a', 128 * 1024));
        using var request = CreateRequest(bytes, contentType, chunked);
        request.Headers.ExpectContinue = false;
        try
        {
            using var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        catch (HttpRequestException)
        {
            // Kestrel may close the connection while the client is still sending the rejected body.
        }

        Assert.Equal(400, await completed.Task.WaitAsync(TimeSpan.FromSeconds(10)));
        Assert.True(bytesRead <= 10 * 1024 * 1024 + 64 * 1024, $"Read {bytesRead} bytes.");
        Assert.Empty(await fixture.Store.GetAllAssetsAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Accepts_A_Ten_MiB_Image_With_Multipart_Overhead(bool chunked)
    {
        using var fixture = new UploadTestContext();
        await using var app = CreateApp(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = await CreateTenMiBPngAsync();
        var (bytes, contentType) = await CreateMultipartAsync(image, "A valid image");
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.True(response.StatusCode == HttpStatusCode.Created, await response.Content.ReadAsStringAsync());
        var asset = Assert.Single(await fixture.Store.GetAllAssetsAsync());
        Assert.Equal(2, asset.Width);
        Assert.Equal(3, asset.Height);
        var stored = await File.ReadAllBytesAsync(Path.Combine(fixture.Root, "App_Data", "LeLøgin", asset.StoragePath));
        Assert.Equal(image, stored);
    }

    private static HttpRequestMessage CreateRequest(
        byte[] bytes, System.Net.Http.Headers.MediaTypeHeaderValue? contentType, bool chunked)
    {
        HttpContent content = chunked
            ? new StreamContent(new UnseekableContent(bytes))
            : new ByteArrayContent(bytes);
        content.Headers.ContentType = contentType;
        var request = new HttpRequestMessage(HttpMethod.Post, "/upload-test/assets")
        {
            Content = content,
            Version = HttpVersion.Version11,
            VersionPolicy = HttpVersionPolicy.RequestVersionExact
        };
        request.Headers.ExpectContinue = true;
        return request;
    }

    private static async Task<byte[]> CreateTenMiBPngAsync()
    {
        using var image = new Image<Rgba32>(2, 3);
        using var encoded = new MemoryStream();
        await image.SaveAsPngAsync(encoded);
        encoded.SetLength(10 * 1024 * 1024);
        return encoded.ToArray();
    }

    private static async Task<(byte[] Bytes, System.Net.Http.Headers.MediaTypeHeaderValue? ContentType)> CreateMultipartAsync(
        byte[] image, string altText)
    {
        using var multipart = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(image);
        using var kindContent = new StringContent("Background");
        using var nameContent = new StringContent("Image");
        using var altTextContent = new StringContent(altText);
        multipart.Add(fileContent, "file", "image.png");
        multipart.Add(kindContent, "kind");
        multipart.Add(nameContent, "name");
        multipart.Add(altTextContent, "altText");
        return (await multipart.ReadAsByteArrayAsync(), multipart.Headers.ContentType);
    }

    private static WebApplication CreateApp(UploadTestContext fixture)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(Umbraco.Cms.Web.Common.Authorization.AuthorizationPolicies.SectionAccessSettings,
                policy => policy.RequireAssertion(_ => true));
            options.AddPolicy(LeLøgin.Core.Api.Authorisation.LeLøginAuthorisationPolicies.ManageLeLøgin,
                policy => policy.RequireAssertion(_ => true));
        });
        builder.Services.AddControllers(options => options.Conventions.Add(new UploadTestRoute()))
            .AddApplicationPart(typeof(AssetController).Assembly)
            .AddControllersAsServices();
        builder.Services.AddTransient<AssetController>(_ => fixture.CreateController());
        var app = builder.Build();
        app.UseDeveloperExceptionPage();
        return app;
    }

    // Keep the real action and MVC binding pipeline; replace only Umbraco routing and event messages.
    private sealed class UploadTestRoute : IApplicationModelConvention
    {
        public void Apply(ApplicationModel application)
        {
            foreach (var controller in application.Controllers.ToArray())
            {
                if (controller.ControllerType != typeof(AssetController))
                {
                    application.Controllers.Remove(controller);
                    continue;
                }
                foreach (var selector in controller.Selectors)
                    selector.AttributeRouteModel = new AttributeRouteModel(new RouteAttribute("upload-test"));
                foreach (var filter in controller.Filters.Where(filter => filter is Umbraco.Cms.Api.Management.Filters.AppendEventMessagesAttribute).ToArray())
                    controller.Filters.Remove(filter);
            }
        }
    }

    private sealed class UnseekableContent(byte[] bytes) : MemoryStream(bytes)
    {
        public override bool CanSeek => false;
    }

    private sealed class CountedRequestStream(Stream inner, Action<int> count) : Stream
    {
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int length)
        {
            var read = inner.Read(buffer, offset, length);
            count(read);
            return read;
        }
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var read = await inner.ReadAsync(buffer, cancellationToken);
            count(read);
            return read;
        }
        public override Task<int> ReadAsync(byte[] buffer, int offset, int length, CancellationToken cancellationToken) =>
            ReadAsync(buffer.AsMemory(offset, length), cancellationToken).AsTask();
        public override void Flush() => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int length) => throw new NotSupportedException();
    }
}
