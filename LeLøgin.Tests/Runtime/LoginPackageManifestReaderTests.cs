using System.Text.Json;
using LeLøgin.Core.Runtime;
using Xunit;

namespace LeLøgin.Tests.Runtime;

/// <summary>
/// The reader must synthesise a <b>static</b> manifest: localisation extensions that point
/// their <c>js</c> loader at the per-request greeting module endpoint and carry no values.
/// The manifest content never changes, so Umbraco's 30-day manifest cache is harmless and
/// no invalidation exists. The greeting itself is resolved per request by the module
/// endpoint — the same freshness model the background-image middleware uses.
/// </summary>
public sealed class LoginPackageManifestReaderTests
{
	/// <summary>
	/// The full set of cultures Umbraco 18.1.0 ships backoffice lang files for. Each defines
	/// <c>login.greeting0..6</c>, so every one needs an extension carrying our override; a
	/// culture missing here would show Umbraco's default greeting to users of that locale.
	/// </summary>
	private static readonly string[] ExpectedCultures =
	[
		"ar", "bs", "cs", "cy", "da", "de", "en", "es", "fr", "he", "hr", "it", "ja",
		"ko", "nb", "nl", "pl", "pt", "ru", "sv", "tr", "uk", "vi", "zh", "zh-tw",
	];

	[Fact]
	public async Task Synthesises_One_Public_Manifest()
	{
		var manifests = (await new LeLøginPackageManifestReader().ReadPackageManifestsAsync()).ToList();

		var manifest = Assert.Single(manifests);
		Assert.True(manifest.AllowPublicAccess);
	}

	[Fact]
	public async Task Registers_A_Localisation_Extension_For_Every_Culture_Umbraco_Ships()
	{
		var extensions = await ReadExtensionsAsJsonAsync();

		var cultures = extensions
			.Select(extension => extension.GetProperty("meta").GetProperty("culture").GetString())
			.ToList();

		Assert.Equal(ExpectedCultures.Order(StringComparer.Ordinal), cultures!.Order(StringComparer.Ordinal));
	}

	[Fact]
	public async Task Extensions_Load_Translations_From_The_Greeting_Module_Endpoint()
	{
		var extensions = await ReadExtensionsAsJsonAsync();

		Assert.All(extensions, extension =>
		{
			Assert.Equal("localization", extension.GetProperty("type").GetString());
			Assert.Equal(
				LeLøginPackageManifestReader.GreetingModulePath,
				extension.GetProperty("js").GetString());
		});
	}

	[Fact]
	public async Task Extensions_Outweigh_Umbraco_Core_Localisations()
	{
		var extensions = await ReadExtensionsAsJsonAsync();

		// Umbraco's registry sorts localisation sets by weight descending and merges in
		// order, so lower weight lands last and wins. Core lang files ship at weight 100.
		Assert.All(extensions, extension =>
			Assert.Equal(0, extension.GetProperty("weight").GetInt32()));
	}

	[Fact]
	public async Task Extensions_Carry_No_Inline_Values()
	{
		var extensions = await ReadExtensionsAsJsonAsync();

		// Inline values would be frozen into the cached manifest — the exact staleness bug
		// this design removes. Values must only ever come from the per-request module.
		Assert.All(extensions, extension =>
			Assert.False(extension.GetProperty("meta").TryGetProperty("localizations", out _)));
	}

	[Fact]
	public async Task Extension_Aliases_Are_Unique_And_Package_Prefixed()
	{
		var extensions = await ReadExtensionsAsJsonAsync();

		var aliases = extensions.Select(extension => extension.GetProperty("alias").GetString()).ToList();

		Assert.Equal(aliases.Count, aliases.Distinct(StringComparer.Ordinal).Count());
		Assert.All(aliases, alias => Assert.StartsWith("LeLøgin.", alias, StringComparison.Ordinal));
	}

	private static async Task<List<JsonElement>> ReadExtensionsAsJsonAsync()
	{
		var manifests = (await new LeLøginPackageManifestReader().ReadPackageManifestsAsync()).ToList();
		var manifest = Assert.Single(manifests);

		return manifest.Extensions
			.Select(extension => JsonSerializer.SerializeToElement(extension))
			.ToList();
	}
}
