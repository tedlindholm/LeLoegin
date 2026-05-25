using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Globalization;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;

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
	RequestAuthorizationUtilities? requestAuthorizationUtilities = null) : RuntimeControllerBase
{
	[HttpGet("runtime/active")]
	[ProducesResponseType<ActiveLeLøginScreenResponse>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status204NoContent)]
	public async Task<IActionResult> GetActive()
	{
		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var context = BuildRuntimeContext(Request, timeProvider);
		var rules = await store.GetAllRulesAsync();
		var asset = runtimeResolver.ResolveAsset(
			backgroundAssets,
			rules,
			context);
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

	[HttpGet("assets/{id}/thumbnail")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Thumbnail(string id)
	{
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

	private static LoginRuntimeContext BuildRuntimeContext(HttpRequest request, TimeProvider timeProvider)
	{
		var now = timeProvider.GetLocalNow();
		return new LoginRuntimeContext(
			now.DayOfWeek.ToString().ToLowerInvariant(),
			now.Month,
			now.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
			request.Host.Host.ToLowerInvariant());
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
