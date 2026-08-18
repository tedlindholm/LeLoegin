using LeLøgin.Core.Api.Assets;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Security;
using Xunit;

namespace LeLøgin.Tests.Api.Assets;

public sealed class AssetControllerTests : IDisposable
{
	private readonly string _contentRootPath = Path.Combine(
		Path.GetTempPath(),
		"LeLøgin.Tests",
		Guid.NewGuid().ToString("N"));

	[Fact]
	public async Task Publish_Returns_BadRequest_When_Single_Asset_Publishing_Is_No_Longer_Supported()
	{
		var defaultBackgroundPath = Path.Combine(_contentRootPath, "assets", "default-background.png");
		var fallbackBackgroundPath = Path.Combine(_contentRootPath, "assets", "fallback-background.png");
		var fallbackLogoPath = Path.Combine(_contentRootPath, "assets", "fallback-logo.png");
		await CreateImageAsync(defaultBackgroundPath, Color.CornflowerBlue);
		await CreateImageAsync(fallbackBackgroundPath, Color.OrangeRed);
		await CreateImageAsync(fallbackLogoPath, Color.HotPink);

		WriteConfig($$"""
		{
		  "assets": [
		    {
		      "id": "asset-default",
		      "name": "Default",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Default",
		      "logoAssetId": null,
		      "storagePath": "{{defaultBackgroundPath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": "/login-screen/legacy-runtime-image.jpg",
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    },
		    {
		      "id": "asset-fallback",
		      "name": "Fallback",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Fallback",
		      "logoAssetId": "logo-fallback",
		      "storagePath": "{{fallbackBackgroundPath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-16T00:00:00Z",
		      "updatedAt": "2026-05-16T00:00:00Z"
		    },
		    {
		      "id": "logo-fallback",
		      "name": "Fallback logo",
		      "kind": 1,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{fallbackLogoPath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 120,
		      "height": 48,
		      "createdAt": "2026-05-16T00:00:01Z",
		      "updatedAt": "2026-05-16T00:00:01Z"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);

		var result = await controller.Publish("asset-fallback");
		var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);

		Assert.Equal(
			"Publishing a single asset is no longer supported. Create a catch-all rule instead.",
			badRequestResult.Value);

		var assets = (await store.GetAllAssetsAsync()).OrderBy(asset => asset.Id).ToList();
		Assert.Collection(
			assets.Where(asset => asset.Kind == LoginImageAssetKind.Background),
			asset => Assert.Equal("/login-screen/legacy-runtime-image.jpg", asset.PublicPath),
			asset => Assert.Null(asset.PublicPath));

		Assert.False(File.Exists(Path.Combine(_contentRootPath, "wwwroot", "login-screen", "active.jpg")));
		Assert.False(File.Exists(Path.Combine(_contentRootPath, "wwwroot", "login-screen", "active-logo.png")));
		Assert.False(File.Exists(Path.Combine(_contentRootPath, "wwwroot", "login-screen", "active-logo.svg")));
	}

	[Fact]
	public async Task Upload_Returns_BadRequest_When_File_Exceeds_10Mb_Limit()
	{
		WriteConfig("""
		{
		  "assets": [],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);

		// Create a form file that exceeds 10 MB (10 * 1024 * 1024 + 1 byte)
		var oversizedContent = new byte[10 * 1024 * 1024 + 1];
		var formFile = new FormFile(
			new MemoryStream(oversizedContent),
			0,
			oversizedContent.Length,
			"file",
			"oversized.png");

		var request = new UploadAssetRequest
		{
			File = formFile,
			Name = "Oversized Image",
			Kind = LoginImageAssetKind.Background
		};

		var result = await controller.Upload(request);
		var badRequestResult = Assert.IsType<BadRequestObjectResult>(result);

		Assert.Contains("exceeds maximum allowed size", badRequestResult.Value?.ToString()!, StringComparison.Ordinal);
	}

	[Fact]
	public async Task Preview_Returns_NotFound_When_Relative_StoragePath_Escapes_Asset_Root()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-traversal",
		      "name": "Traversal",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "../../etc/passwd",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": { "publicEndpointCacheSeconds": 300 },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);

		var result = await controller.Preview("asset-traversal");

		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task Preview_Returns_NotFound_When_Path_Is_Outside_Allowed_Directory()
	{
		var safeAssetPath = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets", "valid.png");
		var unsafePath = Path.Combine(_contentRootPath, "..", "../../etc/passwd");
		Directory.CreateDirectory(Path.GetDirectoryName(safeAssetPath)!);
		File.WriteAllText(safeAssetPath, "safe");
		Directory.CreateDirectory(Path.GetDirectoryName(unsafePath)!);
		File.WriteAllText(unsafePath, "unsafe");

		WriteConfig($$"""
		{
		  "assets": [
		    {
		      "id": "asset-malicious",
		      "name": "Malicious",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{unsafePath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);

		var result = await controller.Preview("asset-malicious");

		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task Preview_Sets_XContentTypeOptions_Nosniff_Header()
	{
		var assetPath = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets", "testimage.png");
		Directory.CreateDirectory(Path.GetDirectoryName(assetPath)!);
		using (var image = new Image<Rgba32>(1, 1))
		{
			image.SaveAsPng(assetPath);
		}

		WriteConfig($$"""
		{
		  "assets": [
		    {
		      "id": "asset-nosniff",
		      "name": "Test",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{assetPath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 1,
		      "height": 1,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);
		controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };

		var result = await controller.Preview("asset-nosniff");

		Assert.IsType<FileStreamResult>(result);
		Assert.Equal("nosniff", controller.Response.Headers.XContentTypeOptions);
	}

	[Theory]
	[InlineData(0.5, 1.0)]              // below min clamps to 1.0
	[InlineData(0.999, 1.0)]            // inside the 1.001 tolerance snaps to 1.0
	[InlineData(2.5, 2.5)]              // valid mid-range passes through
	[InlineData(15.0, 10.0)]            // above max clamps to 10.0
	[InlineData(double.NaN, 1.0)]       // NaN falls back to 1.0 (Math.Clamp would pass through)
	[InlineData(double.PositiveInfinity, 1.0)] // +Inf falls back to 1.0
	public async Task Update_Normalises_Zoom_To_Valid_Range_For_Background_Assets(double inputZoom, double expectedZoom)
	{
		var assetPath = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets", "bg.png");
		await CreateImageAsync(assetPath, Color.CornflowerBlue);

		WriteConfig($$"""
		{
		  "assets": [
		    {
		      "id": "asset-1",
		      "name": "Bg",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{assetPath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": { "publicEndpointCacheSeconds": 300 },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);

		var result = await controller.Update("asset-1", new AssetUpdateRequest(null, null, null, null, null, inputZoom));

		var ok = Assert.IsType<OkObjectResult>(result);
		var asset = Assert.IsType<LoginImageAsset>(ok.Value);
		Assert.Equal(expectedZoom, asset.Zoom);
	}

	[Fact]
	public async Task Update_Forces_Zoom_To_1_For_Logo_Assets_Regardless_Of_Request()
	{
		var logoPath = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets", "logo.png");
		await CreateImageAsync(logoPath, Color.HotPink);

		WriteConfig($$"""
		{
		  "assets": [
		    {
		      "id": "logo-1",
		      "name": "Logo",
		      "kind": 1,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{logoPath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 120,
		      "height": 48,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": { "publicEndpointCacheSeconds": 300 },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = CreateController(store);

		var result = await controller.Update("logo-1", new AssetUpdateRequest(null, null, null, null, null, 5.0));

		var ok = Assert.IsType<OkObjectResult>(result);
		var asset = Assert.IsType<LoginImageAsset>(ok.Value);
		Assert.Equal(1.0, asset.Zoom);
	}

	public void Dispose()
	{
		if (Directory.Exists(_contentRootPath))
		{
			Directory.Delete(_contentRootPath, recursive: true);
		}
	}

	private FakeLeLøginScreenStore CreateStore()
	{
		var configPath = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "config.json");
		var json = File.Exists(configPath) ? File.ReadAllText(configPath) : "{}";
		return FakeLeLøginScreenStoreSeed.FromConfigJson(json);
	}

	private AssetController CreateController(ILeLøginScreenStore store) =>
		new(store,
			new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(_contentRootPath),
				TestFileSystems.PublishFileManager(_contentRootPath),
				new NullLogger<LeLøginScreenFileService>()),
			new AcceptAllFileStreamSecurityValidator(),
			CreatePermissiveContentSettings(),
			TestFileSystems.AssetFileManager(_contentRootPath));

	private void WriteConfig(string json)
	{
		var configDirectory = Path.Combine(_contentRootPath, "App_Data", "LeLøgin");
		Directory.CreateDirectory(configDirectory);
		File.WriteAllText(Path.Combine(configDirectory, "config.json"), json);
	}

	private static async Task CreateImageAsync(string path, Color colour)
	{
		Directory.CreateDirectory(Path.GetDirectoryName(path)!);

		using var image = new Image<Rgba32>(12, 12, colour.ToPixel<Rgba32>());
		await image.SaveAsPngAsync(path);
	}

	private static IOptionsMonitor<ContentSettings> CreatePermissiveContentSettings()
	{
		return new OptionsMonitorStub<ContentSettings>(new ContentSettings());
	}

	private sealed class OptionsMonitorStub<T>(T value) : IOptionsMonitor<T>
	{
		public T CurrentValue => value;
		public T Get(string? name) => value;
		public IDisposable? OnChange(Action<T, string?> listener) => null;
	}

	private sealed class AcceptAllFileStreamSecurityValidator : IFileStreamSecurityValidator
	{
		public bool IsConsideredSafe(Stream stream) => true;
	}

}
