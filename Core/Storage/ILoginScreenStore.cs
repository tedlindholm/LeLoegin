using LeLøgin.Core.Models;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Persistence boundary for the Le Løgin domain entities. Backed by the Umbraco database
/// via NPoco; see <c>LeLøginScreenStore</c>.
/// </summary>
public interface ILeLøginScreenStore
{
	Task<IReadOnlyList<LoginImageAsset>> GetAllAssetsAsync();

	Task<LoginImageAsset?> GetAssetAsync(string id);

	Task UpsertAssetAsync(LoginImageAsset asset);

	Task<bool> DeleteAssetAsync(string id);

	Task<IReadOnlyList<LoginRule>> GetAllRulesAsync();

	Task<LoginRule?> GetRuleAsync(string id);

	Task UpsertRuleAsync(LoginRule rule);

	Task<bool> DeleteRuleAsync(string id);

	Task<LoginSettings> GetSettingsAsync();

	Task UpdateSettingsAsync(LoginSettings settings);
}
