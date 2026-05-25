using Umbraco.Cms.Core.Cache;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Invalidates Umbraco's <c>PackageManifestService</c> runtime-cache entry so the next manifest
/// read picks up the latest greeting / rule / asset state. Callers invoke
/// <see cref="Invalidate"/> from every endpoint that mutates Le Løgin domain state.
///
/// The cache key is the internal one used by <c>PackageManifestService</c>:
/// <c>{nameof(PackageManifestService)}-PackageManifests</c>. If this key changes in a future
/// Umbraco release the invalidation will silently no-op and the greeting will reflect changes
/// only after the cache window (30 days in production, 10 seconds otherwise) expires.
/// </summary>
public sealed class LeLøginPackageManifestCacheInvalidator(AppCaches appCaches)
{
	// Mirror of the key constructed inside Umbraco's PackageManifestService.GetAllPackageManifestsAsync.
	// Verified against src/Umbraco.Infrastructure/Manifest/PackageManifestService.cs at the time
	// of writing. Update here if Umbraco changes the cache key.
	private const string CacheKey = "PackageManifestService-PackageManifests";

	public void Invalidate() => appCaches.RuntimeCache.ClearByKey(CacheKey);
}
