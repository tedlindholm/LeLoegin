using Microsoft.AspNetCore.Http;
using LeLøgin.Core.Models;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Manages source asset files and GUID-backed runtime publications on disc.
/// </summary>
public interface ILeLøginScreenFileService
{
	Task<(string storagePath, int width, int height)> SaveUploadAsync(string assetId, IFormFile file);
	void DeleteAsset(string assetId);
	Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(LoginImageAsset imageAsset);

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
