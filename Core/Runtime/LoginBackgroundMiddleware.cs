using System.Globalization;
using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web;
using SixLabors.ImageSharp.Web.Middleware;

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
public sealed class LeLøginBackgroundMiddleware(RequestDelegate next)
{
	private const string BackgroundPath =
		"/umbraco/management/api/v1/security/back-office/graphics/login-background";

	public async Task InvokeAsync(
		HttpContext context,
		ILeLøginScreenStore store,
		ILeLøginScreenFileService fileService,
		LeLøginScreenRuntimeResolver runtimeResolver,
		TimeProvider timeProvider,
		IOptions<ImageSharpMiddlewareOptions> imageSharpOptions,
		ILogger<LeLøginBackgroundMiddleware> logger,
		RequestAuthorizationUtilities? requestAuthorizationUtilities = null)
	{
		if (!context.Request.Path.StartsWithSegments(BackgroundPath, StringComparison.OrdinalIgnoreCase))
		{
			await next(context);
			return;
		}

		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var runtimeContext = BuildRuntimeContext(context.Request, timeProvider);
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
			var runtimeAssets = await fileService.EnsureRuntimeAssetsAsync(activeAsset);
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

		context.Response.Redirect(imageUrl, permanent: false);
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
