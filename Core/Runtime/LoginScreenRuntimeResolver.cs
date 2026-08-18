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

			// Resolve to the rule's images that actually exist, then show one. A single-image rule
			// (all/any) is deterministic; a random rule with several images shows one at random.
			var candidates = rule.AssetIds.Where(assetMap.ContainsKey).ToList();
			if (candidates.Count == 0)
				continue;

			// The token pins the choice so the background, logo, and greeting requests of one
			// screen all land on the same image. Plain modulo rather than a hash of the token:
			// .NET string hashing is randomised per process, so a hash would let two instances of
			// a load-balanced site disagree within the same render.
			return assetMap[candidates[(int)((uint)context.RenderToken % (uint)candidates.Count)]];
		}

		return null;
	}
}