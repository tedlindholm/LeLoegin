using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Intercepts both <c>/login-logo</c> and <c>/login-logo-alternative</c> and serves the
/// configured Le Løgin logo asset directly from its source storage path when a background
/// asset matches the current request context (the logo is configured per-background). If no
/// match or no configured logo, the request falls through to Umbraco's BackOfficeGraphicsController.
///
/// Both endpoints currently return the same logo bytes — Le Løgin has a single logo concept,
/// not a primary/alternative split. If we ever need distinct light/dark logos this is the place.
/// </summary>
public sealed class LeLøginLogoMiddleware(RequestDelegate next)
{
	private static readonly string[] LogoPaths =
	[
		"/umbraco/management/api/v1/security/back-office/graphics/login-logo",
		"/umbraco/management/api/v1/security/back-office/graphics/login-logo-alternative",
	];

	public async Task InvokeAsync(
		HttpContext context,
		ILeLøginScreenStore store,
		LeLøginScreenRuntimeResolver runtimeResolver,
		TimeProvider timeProvider,
		LeLøginAssetFileManager assetManager,
		ILogger<LeLøginLogoMiddleware> logger,
		IRuntimeState runtimeState)
	{
		// StartsWithSegments is segment-aware, so each candidate matches its own exact endpoint
		// (not its prefix). We check all configured logo endpoints.
		if (!LogoPaths.Any(path => context.Request.Path.StartsWithSegments(path, StringComparison.OrdinalIgnoreCase)))
		{
			await next(context);
			return;
		}

		if (runtimeState.Level != RuntimeLevel.Run)
		{
			await next(context);
			return;
		}

		var assets = await store.GetAllAssetsAsync();
		var backgroundAssets = assets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var runtimeContext = LoginRuntimeContextFactory.Create(context.Request, timeProvider);
		var rules = await store.GetAllRulesAsync();
		var activeAsset = runtimeResolver.ResolveAsset(
			backgroundAssets,
			rules,
			runtimeContext);

		if (activeAsset?.LogoAssetId is null)
		{
			await next(context);
			return;
		}

		var logoAsset = assets.FirstOrDefault(candidate =>
			candidate.Id == activeAsset.LogoAssetId && candidate.Kind == LoginImageAssetKind.Logo);

		if (logoAsset is null)
		{
			logger.LogDebug(
				"No logo asset found for context {AssetId}; falling through to Umbraco's default",
				activeAsset.LogoAssetId);
			await next(context);
			return;
		}

		try
		{
			if (!assetManager.FileSystem.FileExists(logoAsset.StoragePath))
			{
				logger.LogDebug(
					"No logo asset on disc for context {AssetId}; falling through to Umbraco's default",
					activeAsset.LogoAssetId);
				await next(context);
				return;
			}

			if (!new FileExtensionContentTypeProvider().TryGetContentType(logoAsset.StoragePath, out var contentType))
			{
				contentType = "application/octet-stream";
			}

			context.Response.ContentType = contentType;
			context.Response.Headers.XContentTypeOptions = "nosniff";
			await using var stream = assetManager.FileSystem.OpenFile(logoAsset.StoragePath);
			await stream.CopyToAsync(context.Response.Body);
		}
		catch (UnauthorizedAccessException)
		{
			logger.LogWarning(
				"Logo middleware refused to serve file outside safe directory: {StoragePath}",
				logoAsset.StoragePath);
			await next(context);
		}
	}
}
