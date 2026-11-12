using LeLøgin.Core.Models;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Resolves which login image asset should be shown for a given runtime context.
/// </summary>
public sealed class LeLøginScreenRuntimeResolver
{
	private readonly StringComparer _assetIdComparer = StringComparer.OrdinalIgnoreCase;

	/// <summary>
	/// Returns the asset of the first enabled rule, by priority then id, whose condition matches
	/// <paramref name="context"/> and that references at least one existing asset. With several
	/// existing assets the render token picks one deterministically. Rules with unsupported
	/// conditions are skipped.
	/// </summary>
	/// <param name="assets">The candidate assets, normally the background assets.</param>
	/// <param name="rules">All stored rules.</param>
	/// <param name="context">The request's runtime context.</param>
	/// <returns>The asset to show, or <see langword="null"/> when no rule applies.</returns>
	public LoginImageAsset? ResolveAsset(
		IEnumerable<LoginImageAsset> assets,
		IEnumerable<LoginRule> rules,
		LoginRuntimeContext context)
	{
		var assetMap = assets.ToDictionary(asset => asset.Id, _assetIdComparer);

		// Ties break on id so the winner does not depend on the order the database returns rows in.
		foreach (var rule in rules.Where(r => r.Enabled).OrderBy(r => r.Priority).ThenBy(r => r.Id, StringComparer.Ordinal))
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

	/// <summary>
	/// Returns every asset that <see cref="ResolveAsset"/> could return for some request: the
	/// existing assets that any enabled rule references, whether or not the rule matches now.
	/// These are the images whose public copies must stay published.
	/// </summary>
	/// <param name="assets">The candidate assets, normally the background assets.</param>
	/// <param name="rules">All stored rules.</param>
	/// <returns>Each resolvable asset once.</returns>
	public IReadOnlyCollection<LoginImageAsset> GetResolvableAssets(
		IEnumerable<LoginImageAsset> assets,
		IEnumerable<LoginRule> rules)
	{
		var assetMap = assets.ToDictionary(asset => asset.Id, _assetIdComparer);

		return rules
			.Where(rule => rule.Enabled)
			.SelectMany(rule => rule.AssetIds)
			.Distinct(_assetIdComparer)
			.Where(assetMap.ContainsKey)
			.Select(assetId => assetMap[assetId])
			.ToList();
	}
}