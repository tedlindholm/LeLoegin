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
