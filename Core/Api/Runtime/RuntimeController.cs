using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Globalization;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;

namespace LeLøgin.Core.Api.Runtime;

/// <summary>
/// Public endpoint that returns the active login screen image path.
/// Called by the appEntryPoint before authentication.
/// </summary>
public class RuntimeController(
	ILeLøginScreenStore store,
	ILeLøginScreenFileService fileService,
	LeLøginScreenRuntimeResolver runtimeResolver,
	TimeProvider timeProvider,
	ILogger<RuntimeController> logger,
	LeLøginAssetFileManager assetManager,
	IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
	IRuntimeState runtimeState,
	RequestAuthorizationUtilities? requestAuthorizationUtilities = null) : RuntimeControllerBase
{
	[HttpGet("runtime/active")]
	[ProducesResponseType<ActiveLeLøginScreenResponse>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status204NoContent)]
	public async Task<IActionResult> GetActive()
	{
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			return NoContent();
		}

		var asset = await ResolveActiveBackgroundAssetAsync();
		if (asset is null)
		{
			logger.LogDebug("No matching rule or catch-all asset resolved for current context");
			return NoContent();
		}

		try
		{
			// The logo is served separately by LoginLogoMiddleware directly from
			// the source asset, so the runtime publication is image-only.
			var runtimeAssets = await fileService.EnsureRuntimeAssetsAsync(asset);
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

		var asset = await ResolveActiveBackgroundAssetAsync();

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

	[HttpGet("assets/{id}/thumbnail")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Thumbnail(string id)
	{
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			return NotFound();
		}

		var asset = await store.GetAssetAsync(id);
		if (asset is null)
		{
			logger.LogWarning("Thumbnail requested for non-existent asset: {AssetId}", id);
			return NotFound();
		}

		EncodedThumbnail thumbnail;
		try
		{
			thumbnail = await fileService.GetThumbnailAsync(asset);
		}
		catch (UnauthorizedAccessException)
		{
			return NotFound();
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Failed to encode thumbnail for asset {AssetId}", id);
			return NotFound();
		}

		Response.Headers["X-Content-Type-Options"] = "nosniff";
		// `Last-Modified` enables conditional GETs: the browser sends `If-Modified-Since`
		// on subsequent requests and ASP.NET's `PhysicalFile` answers 304 when the cached
		// WebP hasn't changed, avoiding a re-download of the same bytes.
		Response.Headers.LastModified = thumbnail.LastModifiedUtc.ToString("R", CultureInfo.InvariantCulture);
		try
		{
			var stream = assetManager.FileSystem.OpenFile(thumbnail.FileName);
			return File(stream, thumbnail.ContentType);
		}
		catch (UnauthorizedAccessException)
		{
			return NotFound();
		}
	}

	/// <summary>
	/// Resolves the background asset that applies to the current request. Shared by the two
	/// endpoints that must always agree on which asset is active — the runtime payload and the
	/// greeting module — so a rule change can never apply to one and not the other.
	/// </summary>
	private async Task<LoginImageAsset?> ResolveActiveBackgroundAssetAsync()
	{
		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var rules = await store.GetAllRulesAsync();
		return runtimeResolver.ResolveAsset(backgroundAssets, rules, BuildRuntimeContext(timeProvider));
	}

	private static LoginRuntimeContext BuildRuntimeContext(TimeProvider timeProvider)
	{
		var now = timeProvider.GetLocalNow();
		return new LoginRuntimeContext(
			now.DayOfWeek.ToString().ToLowerInvariant(),
			now.Month);
	}
}

public sealed record ActiveLeLøginScreenResponse(
	string AssetId,
	string ImageUrl,
	string? AltText,
	string? GreetingText,
	FocalPoint? FocalPoint,
	double? Zoom,
	string? LogoAssetId);
