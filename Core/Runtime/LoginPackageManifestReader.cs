using LeLøgin.Core.Api;
using Umbraco.Cms.Core.Manifest;
using Umbraco.Cms.Infrastructure.Manifest;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Synthesises a <b>static</b> package manifest that registers a localisation extension per
/// backoffice culture, each pointing its <c>js</c> loader at the per-request greeting module
/// endpoint (<see cref="GreetingModulePath"/>). This is exactly how Umbraco delivers its own
/// login-screen text: the core lang files are ES modules registered as localisation
/// extensions and imported through the registry's single loader. Our extension walks the
/// same route — public manifest, same registry, same <c>import()</c>, weight-ordered merge —
/// with one server-side difference the client cannot observe: the module URL renders its
/// translations per request instead of serving a static file.
///
/// Because the manifest content never changes, Umbraco's package-manifest cache (30 days in
/// production) is harmless and Le Løgin performs no cache invalidation at all
/// (AGENTS.md Backend Key Rule 9). Greeting freshness — asset swaps, weekday/month rule
/// flips, random rules, multi-instance hosting — comes from the module endpoint resolving
/// per request, the same model the background-image middleware uses.
/// </summary>
public sealed class LeLøginPackageManifestReader : IPackageManifestReader
{
	/// <summary>
	/// Route of the greeting ES module served by <c>RuntimeController.GreetingModule</c>.
	/// </summary>
	public const string GreetingModulePath = ApiBase.GreetingModulePath;

	/// <summary>
	/// Every culture Umbraco 18.1.0 ships backoffice lang files for. Each of those files
	/// defines <c>login.greeting0..6</c>, so each culture needs its own extension for the
	/// override to win the registry's per-culture merge; a culture missing here shows
	/// Umbraco's default greeting to users of that locale. Update alongside Umbraco upgrades.
	/// </summary>
	private static readonly string[] SupportedCultures =
	[
		"ar", "bs", "cs", "cy", "da", "de", "en", "es", "fr", "he", "hr", "it", "ja",
		"ko", "nb", "nl", "pl", "pt", "ru", "sv", "tr", "uk", "vi", "zh", "zh-tw",
	];

	public Task<IEnumerable<PackageManifest>> ReadPackageManifestsAsync()
	{
		var extensions = SupportedCultures.Select(culture => (object)new
		{
			type = "localization",
			alias = $"LeLøgin.Greeting.{culture}",
			name = "Le Løgin Greeting",
			// Lower weight wins: the registry sorts localisation sets by weight descending
			// and merges in order, so weight 0 lands after Umbraco's built-ins (weight 100).
			weight = 0,
			js = GreetingModulePath,
			meta = new { culture },
		}).ToArray();

		var manifest = new PackageManifest
		{
			Name = "Le Løgin Greeting",
			AllowPublicAccess = true,
			Extensions = extensions,
		};

		return Task.FromResult<IEnumerable<PackageManifest>>([manifest]);
	}
}
