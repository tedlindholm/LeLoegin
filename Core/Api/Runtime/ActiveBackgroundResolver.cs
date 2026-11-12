using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Http;

namespace LeLøgin.Core.Api.Runtime;

/// <summary>
/// Resolves the background asset that applies to a request, plus every image an enabled rule can show.
/// Shared by <see cref="ActiveScreenController"/> and <see cref="RuntimeController"/> so the
/// Overview preview and the greeting module always agree on which asset is active.
/// </summary>
internal static class ActiveBackgroundResolver
{
	internal static async Task<(LoginImageAsset? Asset, IReadOnlyCollection<LoginImageAsset> AssetsToKeepPublished)> ResolveAsync(
		ILeLøginScreenStore store,
		LeLøginScreenRuntimeResolver runtimeResolver,
		HttpRequest request,
		TimeProvider timeProvider)
	{
		var allAssets = await store.GetAllAssetsAsync();
		var backgroundAssets = allAssets
			.Where(asset => asset.Kind == LoginImageAssetKind.Background)
			.ToList();
		var rules = await store.GetAllRulesAsync();
		var asset = runtimeResolver.ResolveAsset(
			backgroundAssets,
			rules,
			LoginRuntimeContextFactory.Create(request, timeProvider));
		return (asset, runtimeResolver.GetResolvableAssets(backgroundAssets, rules));
	}
}

