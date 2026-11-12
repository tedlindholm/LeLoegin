using LeLøgin.Core.Api.Assets;
using LeLøgin.Core.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace LeLøgin.Tests.Api.Assets;

public sealed class AssetControllerUploadTests
{
    [Theory]
    [InlineData("png", LoginImageAssetKind.Background)]
    [InlineData("jpg", LoginImageAssetKind.Background)]
    [InlineData("jpeg", LoginImageAssetKind.Background)]
    [InlineData("webp", LoginImageAssetKind.Background)]
    [InlineData("gif", LoginImageAssetKind.Background)]
    [InlineData("bmp", LoginImageAssetKind.Background)]
    [InlineData("PNG", LoginImageAssetKind.Logo)]
    [InlineData("jpg", LoginImageAssetKind.Logo)]
    [InlineData("jpeg", LoginImageAssetKind.Logo)]
    [InlineData("webp", LoginImageAssetKind.Logo)]
    [InlineData("gif", LoginImageAssetKind.Logo)]
    [InlineData("bmp", LoginImageAssetKind.Logo)]
    public async Task Upload_Preserves_A_Valid_Raster_And_Its_Dimensions(string extension, LoginImageAssetKind kind)
    {
        using var fixture = new UploadTestContext();
        var bytes = await CreateRasterAsync(extension);
        using var upload = new MemoryStream(bytes);
        var result = await fixture.CreateController().Upload(new UploadAssetRequest
        {
            File = new FormFile(upload, 0, bytes.Length, "file", $"image.{extension}"),
            Name = "My image",
            AltText = "  Image description  ",
            Kind = kind
        });

        var created = Assert.IsType<CreatedAtActionResult>(result);
        var asset = Assert.IsType<LoginImageAsset>(created.Value);
        Assert.Equal(2, asset.Width);
        Assert.Equal(3, asset.Height);
        Assert.Equal(kind, asset.Kind);
        Assert.Equal("My image", asset.Name);
        Assert.Equal("Image description", asset.AltText);
        Assert.Equal(asset.Id, Assert.Single(await fixture.Store.GetAllAssetsAsync()).Id);
        var stored = await File.ReadAllBytesAsync(Path.Combine(fixture.Root, "App_Data", "LeLøgin", asset.StoragePath));
        Assert.Equal(bytes, stored);
    }

    [Theory]
    [InlineData("image.png", true, true, "No file provided.")]
    [InlineData("image.aspx", false, true, "not permitted")]
    [InlineData("image.txt", false, true, "not a supported image format")]
    [InlineData("image.svg", false, true, "only supported for logo assets")]
    [InlineData("image.png", false, false, "rejected as potentially unsafe")]
    public async Task Upload_Rejects_Invalid_Inputs_Without_Storing_Anything(
        string fileName, bool empty, bool consideredSafe, string expectedMessage)
    {
        using var fixture = new UploadTestContext(consideredSafe);
        var bytes = empty ? [] : await CreateRasterAsync("png");
        using var upload = new MemoryStream(bytes);
        var result = await fixture.CreateController().Upload(new UploadAssetRequest
        {
            File = new FormFile(upload, 0, bytes.Length, "file", fileName),
            Name = "Rejected image",
            Kind = LoginImageAssetKind.Background
        });

        var error = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains(expectedMessage, Assert.IsType<string>(error.Value), StringComparison.Ordinal);
        Assert.Empty(await fixture.Store.GetAllAssetsAsync());
        var directory = Path.Combine(fixture.Root, "App_Data", "LeLøgin", "assets");
        Assert.False(Directory.Exists(directory) && Directory.EnumerateFiles(directory).Any());
    }

    private static async Task<byte[]> CreateRasterAsync(string extension)
    {
        using var image = new Image<Rgba32>(2, 3);
        using var encoded = new MemoryStream();
        switch (extension.ToLowerInvariant())
        {
            case "png": await image.SaveAsPngAsync(encoded); break;
            case "jpg":
            case "jpeg": await image.SaveAsJpegAsync(encoded); break;
            case "webp": await image.SaveAsWebpAsync(encoded); break;
            case "gif": await image.SaveAsGifAsync(encoded); break;
            case "bmp": await image.SaveAsBmpAsync(encoded); break;
            default: throw new ArgumentOutOfRangeException(nameof(extension));
        }
        return encoded.ToArray();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Upload_Rejects_An_Undecodable_Raster_Without_Storing_A_File_Or_Row(bool truncatedPng)
    {
        using var fixture = new UploadTestContext();
        var store = fixture.Store;
        var controller = fixture.CreateController();
        byte[] bytes = "This is not a PNG image."u8.ToArray();
        if (truncatedPng)
        {
            using var image = new Image<Rgba32>(2, 3);
            using var encoded = new MemoryStream();
            await image.SaveAsPngAsync(encoded);
            bytes = encoded.ToArray()[..33]; // Signature and IHDR, without pixel data.
        }
        using var upload = new MemoryStream(bytes);
        var request = new UploadAssetRequest
        {
            File = new FormFile(upload, 0, bytes.Length, "file", "broken.png"),
            Name = "Broken image",
            Kind = LoginImageAssetKind.Background
        };

        var result = await controller.Upload(request);

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.Empty(await store.GetAllAssetsAsync());
        var directory = Path.Combine(fixture.Root, "App_Data", "LeLøgin", "assets");
        Assert.False(Directory.Exists(directory) && Directory.EnumerateFiles(directory).Any());
    }
}
