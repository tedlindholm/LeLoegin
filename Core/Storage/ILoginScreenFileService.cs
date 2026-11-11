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
	/// </summary>
	/// <exception cref="InvalidDataException">An SVG upload is not well-formed SVG.</exception>
	Task<(string storagePath, int width, int height)> SaveUploadAsync(string assetId, IFormFile file);
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
	Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(
		LoginImageAsset imageAsset,
		IReadOnlyCollection<LoginImageAsset> assetsToKeepPublished);

	/// <summary>
	/// Returns a publicly-servable path to a cached, downscaled WebP thumbnail of the
	/// asset, regenerating the cache when the source file is newer than the cached
	/// version. SVG sources are returned as-is — they're already small and lossless.
	/// </summary>
	Task<EncodedThumbnail> GetThumbnailAsync(LoginImageAsset asset);
}

/// <summary>
/// Public runtime asset paths for a resolved login-screen exposure.
/// </summary>
public sealed record PublishedRuntimeAssetPaths(string ImageUrl);

/// <summary>
/// A thumbnail ready to stream to the client — filesystem-relative path plus the headers
/// the controller needs to set so caching and content-type are correct.
/// </summary>
public sealed record EncodedThumbnail(string FileName, string ContentType, DateTime LastModifiedUtc);
