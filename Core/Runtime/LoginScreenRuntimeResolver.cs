using LeLøgin.Core.Models;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Resolves which login image asset should be shown for a given runtime context.
/// </summary>
public sealed class LeLøginScreenRuntimeResolver
{
	private readonly StringComparer _assetIdComparer = StringComparer.OrdinalIgnoreCase;

	public LoginImageAsset? ResolveAsset(
		IEnumerable<LoginImageAsset> assets,
		IEnumerable<LoginRule> rules,
		LoginRuntimeContext context)
	{
		var assetMap = assets.ToDictionary(asset => asset.Id, _assetIdComparer);

		foreach (var rule in rules.Where(r => r.Enabled).OrderBy(r => r.Priority))
		{
			if (!LoginRuleConditionEvaluator.TryEvaluate(rule.Condition, context, out var matches) || !matches)
				continue;

			if (assetMap.TryGetValue(rule.AssetId, out var asset))
				return asset;
		}

		return null;
	}
}