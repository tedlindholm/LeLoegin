using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Intercepts the management API endpoint that serves the login-page background image and,
/// when a Le Løgin background asset matches the current request context, 302-redirects the
/// browser to the ImageSharp-processed public URL for that asset (so focal-point/zoom crops
/// configured by the editor are preserved). Otherwise the request falls through to Umbraco's
/// BackOfficeGraphicsController.
///
/// Pairs with <see cref="LeLøginLogoMiddleware"/>: between them they replace every default
/// image Umbraco ships on the login screen, so the browser only ever paints Le Løgin assets —
/// no flash-of-default, no client-side overpaint, no <c>--umb-login-image</c> CSS variable.
/// </summary>
/// <param name="next">The next middleware, invoked whenever Le Løgin does not handle the request.</param>
public sealed class LeLøginBackgroundMiddleware(RequestDelegate next)
{
	private const string BackgroundPath =
		"/umbraco/management/api/v1/security/back-office/graphics/login-background";

	/// <summary>
	/// Handles one request. Only the login-background path is considered, and only once Umbraco
	/// is fully running. On a match it publishes the runtime copies of every resolvable background
	/// (side effect on the publish file system) and answers with an uncacheable 302 to the
	/// processed image; on no match, or on any publishing failure (logged), it calls the next middleware.
	/// </summary>
	/// <param name="context">The current HTTP context.</param>
	/// <param name="store">Source of assets and rules.</param>
	/// <param name="fileService">Publishes the public runtime copy of the chosen asset.</param>
	/// <param name="runtimeResolver">Picks the asset for the request's runtime context.</param>
	/// <param name="timeProvider">Clock used to build the runtime context.</param>
	/// <param name="imageSharpOptions">ImageSharp.Web options, read for the HMAC key.</param>
	/// <param name="logger">Logger for publishing failures.</param>
	/// <param name="runtimeState">Umbraco runtime state; requests pass through until it is <see cref="RuntimeLevel.Run"/>.</param>
	/// <param name="requestAuthorizationUtilities">Signs the image URL when HMAC is configured; optional.</param>
	/// <returns>A task that completes when the response is written or the next middleware finishes.</returns>
	public async Task InvokeAsync(
		HttpContext context,
		ILeLøginScreenStore store,
		ILeLøginScreenFileService fileService,
		LeLøginScreenRuntimeResolver runtimeResolver,
		TimeProvider timeProvider,
		IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
		ILogger<LeLøginBackgroundMiddleware> logger,
		IRuntimeState runtimeState,
		RequestAuthorizationUtilities? requestAuthorizationUtilities = null)
	{
		if (!context.Request.Path.StartsWithSegments(BackgroundPath, StringComparison.OrdinalIgnoreCase))
		{
			await next(context);
			return;
		}

		if (runtimeState.Level != RuntimeLevel.Run)
		{
			await next(context);
			return;
		}

		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var runtimeContext = LoginRuntimeContextFactory.Create(context.Request, timeProvider);
		var rules = await store.GetAllRulesAsync();
		var activeAsset = runtimeResolver.ResolveAsset(
			backgroundAssets,
			rules,
			runtimeContext);

		if (activeAsset is null)
		{
			await next(context);
			return;
		}

		string imageUrl;
		try
		{
			var runtimeAssets = await fileService.EnsureRuntimeAssetsAsync(
				activeAsset,
				runtimeResolver.GetResolvableAssets(backgroundAssets, rules));
			imageUrl = LoginScreenImageUrlBuilder.ApplyImageProcessing(
				runtimeAssets.ImageUrl,
				activeAsset.FocalPoint,
				activeAsset.Zoom,
				imageSharpOptions.Value,
				requestAuthorizationUtilities,
				logger);
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Failed to publish runtime assets for background {AssetId}; falling through", activeAsset.Id);
			await next(context);
			return;
		}

		// The target depends on the rule that wins and on random picks; nothing may cache it.
		context.Response.Headers.CacheControl = "no-store";
		context.Response.Redirect(imageUrl, permanent: false);
	}
}
