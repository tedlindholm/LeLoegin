using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;

namespace LeLøgin.Core.Api.Runtime;

/// <summary>
/// Public, read-only endpoints that expose the login screen resolved for the current request.
/// Public before authentication: the Overview preview reads runtime/active and the login page loads runtime/greeting.js.
/// Both endpoints resolve per request and respond with <c>Cache-Control: no-store</c>.
/// </summary>
/// <param name="store">Reads assets and rules.</param>
/// <param name="fileService">Publishes the resolved image to the public file system.</param>
/// <param name="runtimeResolver">Picks the background asset that applies to the request.</param>
/// <param name="timeProvider">Supplies the current time for weekday and month conditions.</param>
/// <param name="logger">Logs resolution and publishing failures.</param>
/// <param name="imageSharpOptions">ImageSharp.Web options used to sign crop URLs.</param>
/// <param name="runtimeState">Reports whether Umbraco is fully running; otherwise the endpoints return empty results.</param>
/// <param name="requestAuthorizationUtilities">Signs ImageSharp.Web command URLs when HMAC is configured; <see langword="null"/> when unavailable.</param>
public class RuntimeController(
	ILeLøginScreenStore store,
	ILeLøginScreenFileService fileService,
	LeLøginScreenRuntimeResolver runtimeResolver,
	TimeProvider timeProvider,
	ILogger<RuntimeController> logger,
	IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
	IRuntimeState runtimeState,
	RequestAuthorizationUtilities? requestAuthorizationUtilities = null) : RuntimeControllerBase
{
	/// <summary>
	/// Returns the background asset that applies to the current request, publishing its image and
	/// pruning published images no enabled rule can show.
	/// </summary>
	/// <returns>
	/// 200 with an <see cref="ActiveLeLøginScreenResponse"/>; 204 when Umbraco is not running, no
	/// rule matches, or publishing fails (the failure is logged).
	/// </returns>
	[HttpGet("runtime/active")]
	[ProducesResponseType<ActiveLeLøginScreenResponse>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status204NoContent)]
	public async Task<IActionResult> GetActive()
	{
		// Resolved per request (rules, random picks), like the greeting module: never cached.
		Response.Headers.CacheControl = "no-store";
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			return NoContent();
		}

		var (asset, assetsToKeepPublished) = await ResolveActiveBackgroundAsync();
		if (asset is null)
		{
			logger.LogDebug("No matching rule or catch-all asset resolved for current context");
			return NoContent();
		}

		try
		{
			// The logo is served separately by LoginLogoMiddleware directly from
			// the source asset, so the runtime publication is image-only.
			var runtimeAssets = await fileService.EnsureRuntimeAssetsAsync(asset, assetsToKeepPublished);
			var imageUrl = LoginScreenImageUrlBuilder.ApplyImageProcessing(
				runtimeAssets.ImageUrl, asset.FocalPoint, asset.Zoom,
				imageSharpOptions.Value, requestAuthorizationUtilities, logger);

			return Ok(new ActiveLeLøginScreenResponse(
				asset.Id,
				imageUrl,
				asset.AltText,
				asset.GreetingText,
				asset.FocalPoint,
				asset.Zoom,
				asset.LogoAssetId));
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Failed to ensure runtime assets for asset {AssetId}", asset.Id);
			return NoContent();
		}
	}

	/// <summary>
	/// Serves the greeting localisation as an ES module, consumed by the package-owned login
	/// bootstrap before it imports Umbraco's login bundle.
	/// Resolved per request with <c>Cache-Control: no-store</c> so asset swaps, weekday/month
	/// rule flips, and random rules apply on the next login-page load on every instance —
	/// the same freshness model as the background-image middleware. Only the <c>login</c>
	/// namespace is emitted: in Umbraco 18 both the login page and the logout view read
	/// <c>login_greeting0..6</c>, and <c>auth_greeting*</c> is deprecated for removal in 20.
	/// </summary>
	/// <returns>
	/// A <c>text/javascript</c> module whose default export overrides every weekday greeting, or an
	/// empty object when no greeting applies or Umbraco is not running.
	/// </returns>
	[HttpGet(ApiBase.GreetingModuleActionRoute)]
	// An ES module resource, not part of the JSON API contract — keep it out of the OpenAPI
	// document so the generated client stays stable.
	[ApiExplorerSettings(IgnoreApi = true)]
	public async Task<IActionResult> GreetingModule()
	{
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			Response.Headers.CacheControl = "no-store";
			return Content("export default {};", "text/javascript; charset=utf-8");
		}

		var (asset, _) = await ResolveActiveBackgroundAsync();

		var greeting = asset?.GreetingText;
		object payload;
		if (string.IsNullOrWhiteSpace(greeting))
		{
			// An empty default export merges nothing; Umbraco's core greetings show as normal.
			payload = new { };
		}
		else
		{
			var greetingValues = new Dictionary<string, string>(StringComparer.Ordinal);
			for (var day = 0; day < 7; day++)
			{
				greetingValues[$"greeting{day}"] = greeting;
			}

			payload = new { login = greetingValues };
		}

		// System.Text.Json's default encoder escapes quotes and non-ASCII, so the serialised
		// object is always a single well-formed JS literal regardless of the greeting text.
		var module = $"export default {System.Text.Json.JsonSerializer.Serialize(payload)};";

		Response.Headers.CacheControl = "no-store";
		return Content(module, "text/javascript; charset=utf-8");
	}

	/// <summary>
	/// Resolves the background asset that applies to the current request, plus every image an
	/// enabled rule can show (the ones that must stay published). Shared by the two endpoints
	/// that must always agree on which asset is active — the runtime payload and the greeting
	/// module — so a rule change can never apply to one and not the other.
	/// </summary>
	private async Task<(LoginImageAsset? Asset, IReadOnlyCollection<LoginImageAsset> AssetsToKeepPublished)> ResolveActiveBackgroundAsync()
	{
		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var rules = await store.GetAllRulesAsync();
		var asset = runtimeResolver.ResolveAsset(
			backgroundAssets,
			rules,
			LoginRuntimeContextFactory.Create(Request, timeProvider));
		return (asset, runtimeResolver.GetResolvableAssets(backgroundAssets, rules));
	}
}

/// <summary>
/// The login screen resolved for a request (runtime/active) or a rule (rules/{id}/preview).
/// </summary>
/// <param name="AssetId">Id of the resolved background asset.</param>
/// <param name="ImageUrl">Public URL of the published image, with ImageSharp crop commands when a focal point or zoom applies.</param>
/// <param name="AltText">Alternative text for the image, if any.</param>
/// <param name="GreetingText">Greeting shown with the image, if any.</param>
/// <param name="FocalPoint">Focal point of the image, if set.</param>
/// <param name="Zoom">Zoom factor around the focal point.</param>
/// <param name="LogoAssetId">Id of the paired logo asset, if any.</param>
public sealed record ActiveLeLøginScreenResponse(
	string AssetId,
	string ImageUrl,
	string? AltText,
	string? GreetingText,
	FocalPoint? FocalPoint,
	double? Zoom,
	string? LogoAssetId);
