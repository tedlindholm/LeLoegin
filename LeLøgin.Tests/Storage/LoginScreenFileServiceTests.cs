using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Metadata.Profiles.Exif;
using SixLabors.ImageSharp.Metadata.Profiles.Iptc;
using SixLabors.ImageSharp.Metadata.Profiles.Xmp;
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

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Keeps_Every_Image_In_The_Keep_Set_Published()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var (assetA, assetB) = await CreateTwoBackgroundsAsync(contentRootPath);
			var service = CreateService(contentRootPath);

			var publicationA = await service.EnsureRuntimeAssetsAsync(assetA, [assetA, assetB]);
			var publicationB = await service.EnsureRuntimeAssetsAsync(assetB, [assetA, assetB]);

			Assert.NotEqual(publicationA.ImageUrl, publicationB.ImageUrl);
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publicationA.ImageUrl)));
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publicationB.ImageUrl)));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Removes_Publications_Outside_The_Keep_Set_When_A_New_Image_Is_Published()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var (assetA, assetB) = await CreateTwoBackgroundsAsync(contentRootPath);
			var service = CreateService(contentRootPath);
			var publicationA = await service.EnsureRuntimeAssetsAsync(assetA, [assetA]);

			var publicationB = await service.EnsureRuntimeAssetsAsync(assetB, [assetB]);

			Assert.False(File.Exists(ToPublicFilePath(contentRootPath, publicationA.ImageUrl)));
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publicationB.ImageUrl)));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Removes_Nothing_When_The_Image_Is_Already_Published()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var (assetA, assetB) = await CreateTwoBackgroundsAsync(contentRootPath);
			var service = CreateService(contentRootPath);
			var publicationA = await service.EnsureRuntimeAssetsAsync(assetA, [assetA, assetB]);
			var publicationB = await service.EnsureRuntimeAssetsAsync(assetB, [assetA, assetB]);

			var repeatedPublicationA = await service.EnsureRuntimeAssetsAsync(assetA, []);

			Assert.Equal(publicationA, repeatedPublicationA);
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publicationA.ImageUrl)));
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, publicationB.ImageUrl)));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Reuses_The_Publication_Across_Service_Instances_And_Publishes_A_New_One_When_The_Asset_Changes()
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var (assetA, _) = await CreateTwoBackgroundsAsync(contentRootPath);
			var editedAssetA = CreateAsset(assetA.Id, assetA.StoragePath, assetA.UpdatedAt.AddMinutes(1));

			var first = await CreateService(contentRootPath).EnsureRuntimeAssetsAsync(assetA, [assetA]);
			var repeated = await CreateService(contentRootPath).EnsureRuntimeAssetsAsync(assetA, [assetA]);
			var edited = await CreateService(contentRootPath).EnsureRuntimeAssetsAsync(editedAssetA, [editedAssetA]);

			Assert.StartsWith("/login-screen/", first.ImageUrl, StringComparison.Ordinal);
			Assert.EndsWith(".jpg", first.ImageUrl, StringComparison.Ordinal);
			Assert.Equal(first, repeated);
			Assert.NotEqual(first.ImageUrl, edited.ImageUrl);
			Assert.False(File.Exists(ToPublicFilePath(contentRootPath, first.ImageUrl)));
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, edited.ImageUrl)));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Theory]
	[InlineData(false)]
	[InlineData(true)]
	public async Task DeleteAsset_Removes_The_Source_Thumbnails_And_Public_Copy_Of_That_Asset_Only(bool blobLikeFileSystems)
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var service = blobLikeFileSystems
				? new LeLøginScreenFileService(
					TestFileSystems.BlobLikeAssetFileManager(contentRootPath),
					TestFileSystems.BlobLikePublishFileManager(contentRootPath),
					new NullLogger<LeLøginScreenFileService>())
				: CreateService(contentRootPath);
			var deleted = await UploadAsync(service, "0123456789abcdef0123456789abcdef", Color.CornflowerBlue);
			var kept = await UploadAsync(service, "fedcba9876543210fedcba9876543210", Color.OrangeRed);
			var deletedPublication = await service.EnsureRuntimeAssetsAsync(deleted, [deleted, kept]);
			var keptPublication = await service.EnsureRuntimeAssetsAsync(kept, [deleted, kept]);
			var deletedThumbnail = await service.GetThumbnailAsync(deleted);
			var keptThumbnail = await service.GetThumbnailAsync(kept);

			service.DeleteAsset(deleted);

			Assert.False(File.Exists(ToAssetFilePath(contentRootPath, deleted.StoragePath)));
			Assert.False(File.Exists(ToAssetFilePath(contentRootPath, deletedThumbnail.FileName)));
			Assert.False(File.Exists(ToPublicFilePath(contentRootPath, deletedPublication.ImageUrl)));
			Assert.True(File.Exists(ToAssetFilePath(contentRootPath, kept.StoragePath)));
			Assert.True(File.Exists(ToAssetFilePath(contentRootPath, keptThumbnail.FileName)));
			Assert.True(File.Exists(ToPublicFilePath(contentRootPath, keptPublication.ImageUrl)));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	private static async Task<LoginImageAsset> UploadAsync(LeLøginScreenFileService service, string assetId, Color colour)
	{
		using var image = new Image<Rgba32>(16, 9, colour.ToPixel<Rgba32>());
		var stream = new MemoryStream();
		await image.SaveAsPngAsync(stream);
		stream.Position = 0;
		var upload = new FormFile(stream, 0, stream.Length, "file", "background.png")
		{
			Headers = new HeaderDictionary(),
			ContentType = "image/png"
		};

		var (storagePath, _, _) = await service.SaveUploadAsync(assetId, upload);
		return CreateAsset(assetId, storagePath, new DateTime(2026, 5, 16, 0, 0, 0, DateTimeKind.Utc));
	}

	private static string ToAssetFilePath(string contentRootPath, string relativePath) =>
		Path.Combine(contentRootPath, "App_Data", "LeLøgin", relativePath.Replace('/', Path.DirectorySeparatorChar));

	[Theory]
	[InlineData("foreign-object", """<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="100"><iframe xmlns="http://www.w3.org/1999/xhtml" srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"/></foreignObject><rect width="10" height="10"/></svg>""", "foreignObject")]
	[InlineData("tab-in-scheme", """<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a href="java&#9;script:alert(1)"><text>link</text></a><use xlink:href="java&#9;script:alert(1)"/><rect width="10" height="10"/></svg>""", "script:")]
	[InlineData("animated-href", """<svg xmlns="http://www.w3.org/2000/svg"><use href="#shape"><animate attributeName="href" to="javascript:alert(1)"/></use><set attributeName="href" to="javascript:alert(1)"/><rect id="shape" width="10" height="10"/></svg>""", "javascript")]
	[InlineData("script-and-handler", """<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(1)</script><rect width="10" height="10"/></svg>""", "alert")]
	[InlineData("external-image", """<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.invalid/tracker.png" width="10" height="10"/><rect width="10" height="10"/></svg>""", "example.invalid")]
	public async Task SaveUploadAsync_Removes_Scriptable_Content_From_Svg_Logos(string _, string svg, string forbidden)
	{
		var contentRootPath = CreateTempDirectory();

		try
		{
			var stored = await UploadSvgAndReadStoredMarkupAsync(contentRootPath, svg);

			Assert.DoesNotContain(forbidden, stored, StringComparison.OrdinalIgnoreCase);
			Assert.Contains("<rect", stored, StringComparison.Ordinal);
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task SaveUploadAsync_Keeps_The_Drawing_Of_An_Ordinary_Exported_Svg_Logo()
	{
		const string illustratorStyleSvg = """
			<?xml version="1.0" encoding="utf-8"?>
			<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
			<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="120" height="48" viewBox="0 0 120 48">
			  <style>.brand { fill: #ff00aa; }</style>
			  <defs><linearGradient id="fade"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
			  <g><path class="brand" d="M0 0h10v10z"/><use xlink:href="#mark"/><circle id="mark" r="4" fill="url(#fade)"/></g>
			  <image width="4" height="4" href="data:image/png;base64,iVBORw0KGgo="/>
			  <text x="12" y="30">Le Løgin</text>
			</svg>
			""";
		var contentRootPath = CreateTempDirectory();

		try
		{
			var stored = await UploadSvgAndReadStoredMarkupAsync(contentRootPath, illustratorStyleSvg);

			foreach (var expected in new[] { ".brand { fill: #ff00aa; }", "<linearGradient", "<path", "xlink:href=\"#mark\"", "url(#fade)", "data:image/png;base64,", ">Le Løgin</text>" })
			{
				Assert.Contains(expected, stored, StringComparison.Ordinal);
			}

			Assert.DoesNotContain("DOCTYPE", stored, StringComparison.Ordinal);
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	private static async Task<string> UploadSvgAndReadStoredMarkupAsync(string contentRootPath, string svg)
	{
		var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(svg));
		var upload = new FormFile(stream, 0, stream.Length, "file", "logo.svg")
		{
			Headers = new HeaderDictionary(),
			ContentType = "image/svg+xml"
		};

		var (storagePath, _, _) = await CreateService(contentRootPath).SaveUploadAsync("logo-asset", upload);
		return await File.ReadAllTextAsync(ToAssetFilePath(contentRootPath, storagePath));
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Strips_Exif_Xmp_And_Iptc_Metadata_From_Published_Image()
	{
		var contentRootPath = CreateTempDirectory();
		try
		{
			var sourcePath = Path.Combine(contentRootPath, "App_Data", "LeLøgin", "assets", "gps-source.jpg");
			Directory.CreateDirectory(Path.GetDirectoryName(sourcePath)!);
			using (var source = new Image<Rgba32>(16, 16, Color.CornflowerBlue.ToPixel<Rgba32>()))
			{
				var exif = new ExifProfile();
				exif.SetValue(ExifTag.Make, "Leica");
				exif.SetValue(ExifTag.GPSLatitude, [new Rational(55, 1), new Rational(40, 1), new Rational(34, 1)]);
				source.Metadata.ExifProfile = exif;
				source.Metadata.XmpProfile = new XmpProfile("<x:xmpmeta xmlns:x=\"adobe:ns:meta/\"/>"u8.ToArray());
				source.Metadata.IptcProfile = new IptcProfile();
				await source.SaveAsJpegAsync(sourcePath);
			}

			var asset = CreateAsset("asset-gps", "assets/gps-source.jpg", new DateTime(2026, 5, 16, 0, 0, 0, DateTimeKind.Utc));
			var service = CreateService(contentRootPath);

			var publication = await service.EnsureRuntimeAssetsAsync(asset, [asset]);
			var publishedPath = ToPublicFilePath(contentRootPath, publication.ImageUrl);

			using var published = await Image.LoadAsync(publishedPath);
			Assert.Null(published.Metadata.ExifProfile);
			Assert.Null(published.Metadata.XmpProfile);
			Assert.Null(published.Metadata.IptcProfile);

			var thumbnail = await service.GetThumbnailAsync(asset);
			var thumbnailPath = Path.Combine(contentRootPath, "App_Data", "LeLøgin", thumbnail.FileName.Replace('/', Path.DirectorySeparatorChar));
			using var thumbImage = await Image.LoadAsync(thumbnailPath);
			Assert.Null(thumbImage.Metadata.ExifProfile);
			Assert.Null(thumbImage.Metadata.XmpProfile);
			Assert.Null(thumbImage.Metadata.IptcProfile);
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task SaveUploadAsync_Rejects_Images_Exceeding_Maximum_Pixel_Count()
	{
		var contentRootPath = CreateTempDirectory();
		try
		{
			var service = CreateService(contentRootPath);
			await using var stream = new MemoryStream();
			using (var oversized = new Image<Rgba32>(6000, 5000, Color.CornflowerBlue.ToPixel<Rgba32>()))
			{
				await oversized.SaveAsPngAsync(stream);
			}
			stream.Position = 0;

			var upload = new FormFile(stream, 0, stream.Length, "file", "huge.png")
			{
				Headers = new HeaderDictionary(),
				ContentType = "image/png"
			};

			await Assert.ThrowsAsync<InvalidDataException>(() => service.SaveUploadAsync("huge-asset", upload));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_Only_Prunes_LeLøgin_Publication_Files()
	{
		var contentRootPath = CreateTempDirectory();
		try
		{
			var (assetA, _) = await CreateTwoBackgroundsAsync(contentRootPath);
			var service = CreateService(contentRootPath);

			var publishRoot = Path.Combine(contentRootPath, "wwwroot", "login-screen");
			Directory.CreateDirectory(publishRoot);
			var unrelatedText = Path.Combine(publishRoot, "keep-me.txt");
			var unrelatedJpg = Path.Combine(publishRoot, "other-image.jpg");
			var stalePublication = Path.Combine(publishRoot, "0123456789abcdef0123456789abcdef.jpg");
			var nestedPublication = Path.Combine(publishRoot, "nested", "0123456789abcdef0123456789abcdef.jpg");
			Directory.CreateDirectory(Path.GetDirectoryName(nestedPublication)!);
			await File.WriteAllTextAsync(unrelatedText, "keep");
			await File.WriteAllTextAsync(unrelatedJpg, "keep");
			await File.WriteAllTextAsync(stalePublication, "stale");
			await File.WriteAllTextAsync(nestedPublication, "keep-nested");

			await service.EnsureRuntimeAssetsAsync(assetA, [assetA]);

			Assert.True(File.Exists(unrelatedText));
			Assert.True(File.Exists(unrelatedJpg));
			Assert.True(File.Exists(nestedPublication));
			Assert.False(File.Exists(stalePublication));
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	[Fact]
	public async Task EnsureRuntimeAssetsAsync_AutoOrients_Before_Stripping_Exif_Metadata()
	{
		var contentRootPath = CreateTempDirectory();
		try
		{
			var sourcePath = Path.Combine(contentRootPath, "App_Data", "LeLøgin", "assets", "rotated-source.jpg");
			Directory.CreateDirectory(Path.GetDirectoryName(sourcePath)!);
			using (var source = new Image<Rgba32>(20, 10, Color.CornflowerBlue.ToPixel<Rgba32>()))
			{
				var exif = new ExifProfile();
				exif.SetValue(ExifTag.Orientation, (ushort)6);
				source.Metadata.ExifProfile = exif;
				await source.SaveAsJpegAsync(sourcePath);
			}

			var asset = CreateAsset("asset-rotated", "assets/rotated-source.jpg", new DateTime(2026, 5, 16, 0, 0, 0, DateTimeKind.Utc));
			var service = CreateService(contentRootPath);

			var publication = await service.EnsureRuntimeAssetsAsync(asset, [asset]);
			var publishedPath = ToPublicFilePath(contentRootPath, publication.ImageUrl);

			using var published = await Image.LoadAsync(publishedPath);
			Assert.Equal(10, published.Width);
			Assert.Equal(20, published.Height);
			Assert.Null(published.Metadata.ExifProfile);
		}
		finally
		{
			Directory.Delete(contentRootPath, recursive: true);
		}
	}

	private static LeLøginScreenFileService CreateService(string contentRootPath) => new(
		TestFileSystems.AssetFileManager(contentRootPath),
		TestFileSystems.PublishFileManager(contentRootPath),
		new NullLogger<LeLøginScreenFileService>());

	private static async Task<(LoginImageAsset AssetA, LoginImageAsset AssetB)> CreateTwoBackgroundsAsync(string contentRootPath)
	{
		var assetRoot = Path.Combine(contentRootPath, "App_Data", "LeLøgin", "assets");
		await CreateImageAsync(Path.Combine(assetRoot, "source-background-a.png"), Color.CornflowerBlue, width: 12, height: 12);
		await CreateImageAsync(Path.Combine(assetRoot, "source-background-b.png"), Color.OrangeRed, width: 28, height: 10);

		return (
			CreateAsset("asset-a", "assets/source-background-a.png", new DateTime(2026, 5, 16, 0, 0, 0, DateTimeKind.Utc)),
			CreateAsset("asset-b", "assets/source-background-b.png", new DateTime(2026, 5, 17, 0, 0, 0, DateTimeKind.Utc)));
	}

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
