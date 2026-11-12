using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;

namespace LeLøgin.Core.Api.Runtime;

/// <summary>
/// Authenticated management endpoint that resolves the currently active login screen for the
/// Overview preview.
/// </summary>
/// <param name="store">Reads assets and rules.</param>
/// <param name="fileService">Publishes the resolved image to the public file system.</param>
/// <param name="runtimeResolver">Picks the background asset that applies to the request.</param>
/// <param name="timeProvider">Supplies the current time for weekday and month conditions.</param>
/// <param name="logger">Logs resolution and publishing failures.</param>
/// <param name="imageSharpOptions">ImageSharp.Web options used to sign crop URLs.</param>
/// <param name="runtimeState">Reports whether Umbraco is fully running; otherwise the endpoint returns 204.</param>
/// <param name="requestAuthorizationUtilities">Signs ImageSharp.Web command URLs when HMAC is configured; <see langword="null"/> when unavailable.</param>
public sealed class ActiveScreenController(
	ILeLøginScreenStore store,
	ILeLøginScreenFileService fileService,
	LeLøginScreenRuntimeResolver runtimeResolver,
	TimeProvider timeProvider,
	ILogger<ActiveScreenController> logger,
	IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
	IRuntimeState runtimeState,
	RequestAuthorizationUtilities? requestAuthorizationUtilities = null) : ApiControllerBase
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

		var (asset, assetsToKeepPublished) = await ActiveBackgroundResolver.ResolveAsync(
			store,
			runtimeResolver,
			Request,
			timeProvider);
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

