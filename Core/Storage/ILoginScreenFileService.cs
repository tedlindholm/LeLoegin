using Microsoft.AspNetCore.Http;
using LeLøgin.Core.Models;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Manages source asset files and GUID-backed runtime publications on disc.
/// </summary>
public interface ILeLøginScreenFileService
{
	/// <summary>
	/// Stores an uploaded image under <paramref name="assetId"/>. SVG uploads are reduced to
	/// drawing content before they are stored.
	/// Raster uploads are validated by decoding them with ImageSharp; the original bytes are stored.
	/// </summary>
	/// <param name="assetId">The asset id; becomes the stored file name, with the upload's lower-cased extension.</param>
	/// <param name="file">The uploaded file.</param>
	/// <returns>The asset-file-system-relative storage path and the image's pixel dimensions (0 when an SVG declares none).</returns>
	/// <exception cref="InvalidDataException">The upload is not a valid image, or an SVG upload is not well-formed SVG.</exception>
	Task<(string storagePath, int width, int height)> SaveUploadAsync(string assetId, IFormFile file);

	/// <summary>
	/// Removes the asset's source file, its cached thumbnails and the public copy of its current
	/// version. Missing files are ignored.
	/// </summary>
	/// <param name="asset">The asset whose files to delete.</param>
	/// <exception cref="ArgumentNullException"><paramref name="asset"/> is <see langword="null"/>.</exception>
	void DeleteAsset(LoginImageAsset asset);

	/// <summary>
	/// Publishes <paramref name="imageAsset"/> to the public file system when it is not there
	/// yet and returns its public URL.
	/// </summary>
	/// <param name="imageAsset">The background asset to publish.</param>
	/// <param name="assetsToKeepPublished">
	/// Every asset whose publication must survive clean-up: the images any enabled rule can
	/// resolve to. <paramref name="imageAsset"/> is always kept, whether or not it is listed.
	/// </param>
	/// <returns>The public paths of the publication.</returns>
	/// <exception cref="ArgumentNullException">Either argument is <see langword="null"/>.</exception>
	Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(
		LoginImageAsset imageAsset,
		IReadOnlyCollection<LoginImageAsset> assetsToKeepPublished);

	/// <summary>
	/// Returns a publicly-servable path to a cached, downscaled WebP thumbnail of the
	/// asset, regenerating the cache when the source file is newer than the cached
	/// version. SVG sources are returned as-is — they're already small and lossless.
	/// </summary>
	/// <param name="asset">The asset to thumbnail.</param>
	/// <returns>The thumbnail's location in the asset file system and its response metadata.</returns>
	/// <exception cref="FileNotFoundException">The asset's source file is missing.</exception>
	Task<EncodedThumbnail> GetThumbnailAsync(LoginImageAsset asset);
}

/// <summary>
/// Public runtime asset paths for a resolved login-screen exposure.
/// </summary>
/// <param name="ImageUrl">Public URL of the published JPEG copy, before any ImageSharp processing.</param>
public sealed record PublishedRuntimeAssetPaths(string ImageUrl);

/// <summary>
/// A thumbnail ready to stream to the client — filesystem-relative path plus the headers
/// the controller needs to set so caching and content-type are correct.
/// </summary>
/// <param name="FileName">Path of the file to stream, relative to the asset file system.</param>
/// <param name="ContentType">MIME type to send: <c>image/webp</c>, or <c>image/svg+xml</c> for SVG sources.</param>
/// <param name="LastModifiedUtc">Last-modified time of that file, for conditional-request headers.</param>
public sealed record EncodedThumbnail(string FileName, string ContentType, DateTime LastModifiedUtc);
