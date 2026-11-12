using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
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
        await using var app = ManagementTestHost.Create(fixture);
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
        await AssertNoStoredAssetsAsync(fixture);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Bounds_An_Oversized_Body_Already_Being_Sent(bool chunked)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
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
        await AssertNoStoredAssetsAsync(fixture);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Accepts_A_Ten_MiB_Image_With_Multipart_Overhead(bool chunked)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = await CreatePngAsync(10 * 1024 * 1024);
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

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Upload_Returns_400_Over_Http_For_Invalid_Image_Content(bool chunked, bool truncatedPng)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = truncatedPng ? await CreatePngAsync(33) : "not an image"u8.ToArray();
        var (bytes, contentType) = await CreateMultipartAsync(image, "");
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("not a valid image", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        await AssertNoStoredAssetsAsync(fixture);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Rejects_A_File_One_Byte_Over_The_Limit(bool chunked)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = await CreatePngAsync(10_485_761);
        var (bytes, contentType) = await CreateMultipartAsync(image, "");
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Multipart body length limit", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        await AssertNoStoredAssetsAsync(fixture);
    }

    [Theory]
    [InlineData(false, 10_551_296, HttpStatusCode.Created)]
    [InlineData(true, 10_551_296, HttpStatusCode.BadRequest)]
    [InlineData(false, 10_551_297, HttpStatusCode.BadRequest)]
    [InlineData(true, 10_551_297, HttpStatusCode.BadRequest)]
    public async Task Upload_Enforces_The_Exact_Total_Request_Boundary(bool chunked, int length, HttpStatusCode expected)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = await CreatePngAsync(10_485_760);
        var unpadded = await CreateMultipartAsync(image, "");
        var (bytes, contentType) = await CreateMultipartAsync(image, "", length - unpadded.Bytes.Length);
        // Kestrel also counts chunk framing, so chunked content at the cap exceeds its wire limit.
        Assert.Equal(length, bytes.Length);
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.True(response.StatusCode == expected, await response.Content.ReadAsStringAsync());
        if (expected == HttpStatusCode.Created)
        {
            Assert.Single(await fixture.Store.GetAllAssetsAsync());
        }
        else
        {
            Assert.Contains("Request body too large", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
            await AssertNoStoredAssetsAsync(fixture);
        }
    }

    [Theory]
    [InlineData(false, "file")]
    [InlineData(true, "file")]
    [InlineData(false, "name")]
    [InlineData(true, "name")]
    public async Task Upload_Rejects_Missing_Required_Fields(bool chunked, string missingField)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = await CreatePngAsync(512);
        var (bytes, contentType) = await CreateMultipartAsync(image, "", missingField: missingField);
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Contains(problem.Errors.Keys, key => key.Equals(missingField, StringComparison.OrdinalIgnoreCase));
        await AssertNoStoredAssetsAsync(fixture);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task Upload_Rejects_Malformed_Or_Truncated_Multipart(bool chunked, bool brokenHeaders)
    {
        using var fixture = new UploadTestContext();
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var bytes = await CreateBrokenMultipartAsync(brokenHeaders);
        var contentType = MediaTypeHeaderValue.Parse("multipart/form-data; boundary=lelogin-incomplete");
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Failed to read the request form", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        await AssertNoStoredAssetsAsync(fixture);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Returns_500_Without_An_Asset_Row_When_Storage_Cannot_Write(bool chunked)
    {
        using var fixture = new UploadTestContext();
        var assetRoot = Path.Combine(fixture.Root, "App_Data", "LeLøgin");
        Directory.CreateDirectory(assetRoot);
        var blockedDirectory = Path.Combine(assetRoot, "assets");
        // A file at the directory path makes the real filesystem's upload write fail.
        await File.WriteAllTextAsync(blockedDirectory, "Storage is blocked.");
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var image = await CreatePngAsync(512);
        var (bytes, contentType) = await CreateMultipartAsync(image, "");
        using var request = CreateRequest(bytes, contentType, chunked);
        using var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Contains("System.IO.IOException", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.Empty(await fixture.Store.GetAllAssetsAsync());
        Assert.Equal("Storage is blocked.", await File.ReadAllTextAsync(blockedDirectory));
        Assert.Single(Directory.EnumerateFiles(assetRoot, "*", SearchOption.AllDirectories));
    }

    private static async Task<byte[]> CreateBrokenMultipartAsync(bool brokenHeaders)
    {
        const string boundary = "--lelogin-incomplete\r\n";
        if (brokenHeaders)
        {
            return Encoding.UTF8.GetBytes(boundary + "invalid header\r\n\r\n");
        }

        var prefix = Encoding.UTF8.GetBytes(boundary +
            "Content-Disposition: form-data; name=\"file\"; filename=\"image.png\"\r\n" +
            "Content-Type: image/png\r\n\r\n");
        var image = await CreatePngAsync(512);
        return [.. prefix, .. image[..32]];
    }

    private static async Task AssertNoStoredAssetsAsync(UploadTestContext fixture)
    {
        Assert.Empty(await fixture.Store.GetAllAssetsAsync());
        var directory = Path.Combine(fixture.Root, "App_Data", "LeLøgin", "assets");
        Assert.False(Directory.Exists(directory) && Directory.EnumerateFiles(directory).Any());
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

    private static async Task<byte[]> CreatePngAsync(int length)
    {
        using var image = new Image<Rgba32>(2, 3);
        using var encoded = new MemoryStream();
        await image.SaveAsPngAsync(encoded);
        encoded.SetLength(length);
        return encoded.ToArray();
    }

    private static async Task<(byte[] Bytes, System.Net.Http.Headers.MediaTypeHeaderValue? ContentType)> CreateMultipartAsync(
        byte[] image, string altText, int padding = 0, string? missingField = null)
    {
        using var multipart = new MultipartFormDataContent();
        using var fileContent = new ByteArrayContent(image);
        using var kindContent = new StringContent("Background");
        using var nameContent = new StringContent("Image");
        using var altTextContent = new StringContent(altText);
        using var paddingContent = new StringContent(new string('p', padding));
        if (missingField != "file") multipart.Add(fileContent, "file", "image.png");
        multipart.Add(kindContent, "kind");
        if (missingField != "name") multipart.Add(nameContent, "name");
        multipart.Add(altTextContent, "altText");
        multipart.Add(paddingContent, "padding");
        return (await multipart.ReadAsByteArrayAsync(), multipart.Headers.ContentType);
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
