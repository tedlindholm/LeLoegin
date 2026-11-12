using LeLøgin.Core.Models;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Persistence boundary for the Le Løgin domain entities. Backed by the Umbraco database
/// via NPoco; see <c>LeLøginScreenStore</c>.
/// </summary>
public interface ILeLøginScreenStore
{
	/// <summary>Reads every stored asset, backgrounds and logos alike, in no guaranteed order.</summary>
	/// <returns>All assets; empty when none exist.</returns>
	Task<IReadOnlyList<LoginImageAsset>> GetAllAssetsAsync();

	/// <summary>Reads one asset by id.</summary>
	/// <param name="id">The asset id.</param>
	/// <returns>The asset, or <see langword="null"/> when no asset has that id.</returns>
	Task<LoginImageAsset?> GetAssetAsync(string id);

	/// <summary>Inserts the asset, or replaces every stored field when its id already exists.</summary>
	/// <param name="asset">The asset to save.</param>
	/// <returns>A task that completes when the asset is saved.</returns>
	Task UpsertAssetAsync(LoginImageAsset asset);

	/// <summary>Deletes the asset's database row. Files are not touched.</summary>
	/// <param name="id">The asset id.</param>
	/// <returns><see langword="true"/> when a row was deleted; <see langword="false"/> when none existed.</returns>
	Task<bool> DeleteAssetAsync(string id);

	/// <summary>Reads every stored rule, enabled or not, in no guaranteed order.</summary>
	/// <returns>All rules; empty when none exist.</returns>
	Task<IReadOnlyList<LoginRule>> GetAllRulesAsync();

	/// <summary>Reads one rule by id.</summary>
	/// <param name="id">The rule id.</param>
	/// <returns>The rule, or <see langword="null"/> when no rule has that id.</returns>
	Task<LoginRule?> GetRuleAsync(string id);

	/// <summary>Inserts the rule, or replaces every stored field when its id already exists.</summary>
	/// <param name="rule">The rule to save.</param>
	/// <returns>A task that completes when the rule is saved.</returns>
	Task UpsertRuleAsync(LoginRule rule);

	/// <summary>Deletes the rule.</summary>
	/// <param name="id">The rule id.</param>
	/// <returns><see langword="true"/> when a row was deleted; <see langword="false"/> when none existed.</returns>
	Task<bool> DeleteRuleAsync(string id);
}
