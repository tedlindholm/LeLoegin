using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using Umbraco.Cms.Core.Manifest;
using Umbraco.Cms.Infrastructure.Manifest;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Synthesises a package manifest that contributes a localisation extension overriding the
/// weekday greeting keys (<c>auth_greeting0..6</c> and <c>login_greeting0..6</c>) with the
/// greeting text configured on the currently-active Le Løgin background asset.
///
/// Umbraco's <c>PackageManifestService</c> aggregates every registered
/// <see cref="IPackageManifestReader"/> and exposes the union via the public manifest endpoint
/// (<c>GET /umbraco/management/api/v1/manifest/public</c>). Registering this reader means the
/// browser receives the greeting override as part of its normal first-load manifest fetch —
/// no separate runtime endpoint, no client-side fetch, no late-arriving localisation extension
/// that races Umbraco's localisation registry.
///
/// Limitation: <see cref="PackageManifestService"/> caches manifests (30 days in production,
/// 10 seconds otherwise). Rule conditions on weekday/month still work for the duration each
/// cache window straddles, and <see cref="LeLøginPackageManifestCacheInvalidator"/> clears
/// the cache when any rule, asset, or setting changes.
/// </summary>
public sealed class LeLøginPackageManifestReader(
	ILeLøginScreenStore store,
	LeLøginScreenRuntimeResolver runtimeResolver,
	TimeProvider timeProvider) : IPackageManifestReader
{
	private static readonly string[] SupportedCultures =
		["en", "en-us", "da", "sv", "fi", "nb", "nb-no"];

	public async Task<IEnumerable<PackageManifest>> ReadPackageManifestsAsync()
	{
		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var runtimeContext = BuildRuntimeContext(timeProvider);
		var rules = await store.GetAllRulesAsync();
		var active = runtimeResolver.ResolveAsset(
			backgroundAssets,
			rules,
			runtimeContext);

		var greeting = active?.GreetingText;
		if (string.IsNullOrWhiteSpace(greeting))
		{
			return Enumerable.Empty<PackageManifest>();
		}

		// Build { greeting0..6 } once, reuse across cultures and both namespaces (auth/login).
		var greetingValues = new Dictionary<string, string>(StringComparer.Ordinal);
		for (var day = 0; day < 7; day++)
		{
			greetingValues[$"greeting{day}"] = greeting;
		}

		// /umbraco/login renders via umb-login-page which reads auth.greeting* keys;
		// /umbraco/backoffice/logout renders via umb-auth-view which reads login.greeting*.
		// Both namespaces must be overridden to cover both screens.
		var localizations = new Dictionary<string, Dictionary<string, string>>(StringComparer.Ordinal)
		{
			["auth"] = greetingValues,
			["login"] = greetingValues,
		};

		var extensions = SupportedCultures.Select(culture => (object)new
		{
			type = "localization",
			alias = $"LeLøgin.Greeting.{culture}",
			name = "Le Løgin Runtime Greeting",
			// Lower weight wins: Umbraco's built-in localisations ship at weight 100,
			// so weight 0 ensures our override is applied last in the merge.
			weight = 0,
			meta = new
			{
				culture,
				localizations,
			},
		}).ToArray();

		var manifest = new PackageManifest
		{
			Name = "Le Løgin Runtime Greeting",
			AllowPublicAccess = true,
			Extensions = extensions,
		};

		return [manifest];
	}

	private static LoginRuntimeContext BuildRuntimeContext(TimeProvider timeProvider)
	{
		var now = timeProvider.GetLocalNow();
		return new LoginRuntimeContext(
			now.DayOfWeek.ToString().ToLowerInvariant(),
			now.Month);
	}
}
