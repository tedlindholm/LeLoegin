using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using Xunit;

namespace LeLøgin.Tests.Storage;

public sealed class LeLøginScreenFileServiceTests
{
	[Fact]
	public async Task SaveUploadAsync_Returns_Relative_StoragePath()
	{
		var contentRootPath = CreateTempDirectory();
		try
		{
			var service = new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(contentRootPath),
				TestFileSystems.PublishFileManager(contentRootPath),
				new NullLogger<LeLøginScreenFileService>());
			await using var stream = CreateSvgStream();
			var upload = new FormFile(stream, 0, stream.Length, "file", "logo.svg")
			{
				Headers = new HeaderDictionary(),
				ContentType = "image/svg+xml"
			};

			var (storagePath, _, _) = await service.SaveUploadAsync("my-asset", upload);

			Assert.Equal("assets/my-asset.svg", storagePath);
			Assert.False(Path.IsPathRooted(storagePath));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task SaveUploadAsync_Allows_Svg_Uploads_Without_ImageSharp_Decoding()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var service = new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(contentRootPath),
				TestFileSystems.PublishFileManager(contentRootPath),
				new NullLogger<LeLøginScreenFileService>());
			await using var stream = CreateSvgStream();
			var upload = new FormFile(stream, 0, stream.Length, "file", "logo.svg")
			{
				Headers = new HeaderDictionary(),
				ContentType = "image/svg+xml"
			};

			var (storagePath, width, height) = await service.SaveUploadAsync("logo-asset", upload);

			var physicalPath = Path.Combine(contentRootPath, "App_Data", "LeLøgin", storagePath.Replace('/', Path.DirectorySeparatorChar));
			Assert.True(File.Exists(physicalPath));
			Assert.Equal(120, width);
			Assert.Equal(48, height);
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	// Two tests previously here (EnsureRuntimeAssetsAsync_Publishes_Svg_Logos... and
	// EnsureRuntimeAssetsAsync_Reuses_Guid_Backed_Files...) targeted the logo-publishing flow
	// removed by commit 5e32e83. They've been deleted in this 1.1.0 refactor. The dedup-by-
	// exposure-key behaviour they relied on is still implemented in the file service; a
	// background-only test for it should be added in a follow-up.
#if FALSE
	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Publishes_Svg_Logos_To_Guid_Backed_Runtime_Paths_Without_Creating_Legacy_Active_Files()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var assetRoot = Path.Combine(contentRootPath, "App_Data", "LeLøgin", "assets");
			Directory.CreateDirectory(assetRoot);
			await CreateImageAsync(Path.Combine(assetRoot, "source-background.png"), Color.CornflowerBlue, width: 16, height: 9);
			await File.WriteAllTextAsync(Path.Combine(assetRoot, "source-logo.svg"), SvgMarkup);

			var service = new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(contentRootPath),
				TestFileSystems.PublishFileManager(contentRootPath),
				new NullLogger<LeLøginScreenFileService>());

			var backgroundAsset = CreateAsset(
				"asset-a",
				"assets/source-background.png",
				new DateTime(2026, 5, 16, 0, 0, 0, DateTimeKind.Utc),
				logoAssetId: "logo-a");
			var logoAsset = CreateAsset(
				"logo-a",
				"assets/source-logo.svg",
				new DateTime(2026, 5, 16, 0, 0, 1, DateTimeKind.Utc),
				kind: LoginImageAssetKind.Logo);

			var publication = await service.EnsureRuntimeAssetsAsync(backgroundAsset, logoAsset);

			Assert.Matches("^/login-screen/runtime-image-[a-f0-9]{32}\\.jpg$", publication.ImageUrl);
			Assert.NotNull(publication.LogoUrl);
			Assert.Matches("^/login-screen/runtime-logo-[a-f0-9]{32}\\.svg$", publication.LogoUrl);
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publication.ImageUrl)));
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publication.LogoUrl)));
			Assert.False(File.Exists(Path.Combine(contentRootPath, "wwwroot", "login-screen", "active.jpg")));
			Assert.False(File.Exists(Path.Combine(contentRootPath, "wwwroot", "login-screen", "active-logo.png")));
			Assert.False(File.Exists(Path.Combine(contentRootPath, "wwwroot", "login-screen", "active-logo.svg")));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Reuses_Guid_Backed_Files_For_The_Same_Exposure_Even_Across_Service_Instances_And_Creates_New_Ones_For_A_Different_Exposure()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var assetRoot = Path.Combine(contentRootPath, "App_Data", "LeLøgin", "assets");
			Directory.CreateDirectory(assetRoot);
			await CreateImageAsync(Path.Combine(assetRoot, "source-background-a.png"), Color.CornflowerBlue, width: 12, height: 12);
			await CreateImageAsync(Path.Combine(assetRoot, "source-background-b.png"), Color.OrangeRed, width: 28, height: 10);
			await CreateImageAsync(Path.Combine(assetRoot, "source-logo-a.png"), Color.HotPink);

			var firstExposure = CreateAsset("asset-a", "assets/source-background-a.png", new DateTime(2026, 5, 16, 0, 0, 0, DateTimeKind.Utc));
			var firstLogo = CreateAsset("logo-a", "assets/source-logo-a.png", new DateTime(2026, 5, 16, 0, 0, 1, DateTimeKind.Utc), kind: LoginImageAssetKind.Logo);
			var secondExposure = CreateAsset("asset-b", "assets/source-background-b.png", new DateTime(2026, 5, 17, 0, 0, 0, DateTimeKind.Utc));

			var firstService = new LeLøginScreenFileService(TestFileSystems.AssetFileManager(contentRootPath), TestFileSystems.PublishFileManager(contentRootPath), new NullLogger<LeLøginScreenFileService>());
			var firstPublication = await firstService.EnsureRuntimeAssetsAsync(firstExposure, firstLogo);
			Assert.Matches("^/login-screen/runtime-image-[a-f0-9]{32}\\.jpg$", firstPublication.ImageUrl);
			Assert.NotNull(firstPublication.LogoUrl);
			Assert.Matches("^/login-screen/runtime-logo-[a-f0-9]{32}\\.png$", firstPublication.LogoUrl);

			var secondService = new LeLøginScreenFileService(TestFileSystems.AssetFileManager(contentRootPath), TestFileSystems.PublishFileManager(contentRootPath), new NullLogger<LeLøginScreenFileService>());
			var repeatedFirstPublication = await secondService.EnsureRuntimeAssetsAsync(firstExposure, firstLogo);
			Assert.Equal(firstPublication, repeatedFirstPublication);

			var thirdService = new LeLøginScreenFileService(TestFileSystems.AssetFileManager(contentRootPath), TestFileSystems.PublishFileManager(contentRootPath), new NullLogger<LeLøginScreenFileService>());
			var secondPublication = await thirdService.EnsureRuntimeAssetsAsync(secondExposure, null);
			Assert.NotEqual(firstPublication.ImageUrl, secondPublication.ImageUrl);
			Assert.Null(secondPublication.LogoUrl);

			var fourthService = new LeLøginScreenFileService(TestFileSystems.AssetFileManager(contentRootPath), TestFileSystems.PublishFileManager(contentRootPath), new NullLogger<LeLøginScreenFileService>());
			var reusedFirstPublication = await fourthService.EnsureRuntimeAssetsAsync(firstExposure, firstLogo);
			Assert.Equal(firstPublication, reusedFirstPublication);

			var firstImagePath = ToPublicFilePath(contentRootPath, firstPublication.ImageUrl);
			var firstPublishedLogoPath = ToPublicFilePath(contentRootPath, firstPublication.LogoUrl);
			var secondImagePath = ToPublicFilePath(contentRootPath, secondPublication.ImageUrl);

			Assert.True(File.Exists(firstImagePath));
			Assert.True(File.Exists(firstPublishedLogoPath));
			Assert.True(File.Exists(secondImagePath));

			using var secondImage = await Image.LoadAsync(secondImagePath);
			Assert.Equal(28, secondImage.Width);
			Assert.Equal(10, secondImage.Height);
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}
#endif

	private static string ToPublicFilePath(string contentRootPath, string? publicPath)
	{
		Assert.False(string.IsNullOrWhiteSpace(publicPath));
		return Path.Combine(contentRootPath, "wwwroot", publicPath!.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
	}

	private static LoginImageAsset CreateAsset(
		string id,
		string storagePath,
		DateTime updatedAt,
		LoginImageAssetKind kind = LoginImageAssetKind.Background,
		string? logoAssetId = null) => new()
	{
		Id = id,
		Name = id,
		Kind = kind,
		LogoAssetId = logoAssetId,
		StoragePath = storagePath,
		Width = 1920,
		Height = 1080,
		UpdatedAt = updatedAt
	};

	private static async Task CreateImageAsync(string path, Color colour, int width = 12, int height = 12)
	{
		Directory.CreateDirectory(Path.GetDirectoryName(path)!);

		using var image = new Image<Rgba32>(width, height, colour.ToPixel<Rgba32>());
		await image.SaveAsPngAsync(path);
	}

	private static MemoryStream CreateSvgStream()
	{
		return new MemoryStream(System.Text.Encoding.UTF8.GetBytes(SvgMarkup));
	}

	private const string SvgMarkup = """
		<svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">
		  <rect width="120" height="48" fill="#ff00aa" />
		  <text x="12" y="30" fill="#ffffff">Le Løgin</text>
		</svg>
		""";

	private static string CreateTempDirectory()
	{
		var path = Path.Combine(Path.GetTempPath(), "LeLøginTests", Guid.NewGuid().ToString("N"));
		Directory.CreateDirectory(path);
		return path;
	}
}
