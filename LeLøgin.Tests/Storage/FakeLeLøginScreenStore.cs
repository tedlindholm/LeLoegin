using System.Collections.Concurrent;
using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;

namespace LeLøgin.Tests.Storage;

/// <summary>
/// In-memory <see cref="ILeLøginScreenStore"/> test double. Replaces the production
/// Umbraco-database-backed store in unit tests so controller and middleware tests can
/// seed state directly without spinning up a real Umbraco DB.
/// </summary>
public sealed class FakeLeLøginScreenStore : ILeLøginScreenStore
{
	private readonly ConcurrentDictionary<string, LoginImageAsset> _assets = new(StringComparer.OrdinalIgnoreCase);
	private readonly ConcurrentDictionary<string, LoginRule> _rules = new(StringComparer.OrdinalIgnoreCase);
	private LoginSettings _settings = new();

	public Task<IReadOnlyList<LoginImageAsset>> GetAllAssetsAsync() =>
		Task.FromResult<IReadOnlyList<LoginImageAsset>>(_assets.Values.ToList());

	public Task<LoginImageAsset?> GetAssetAsync(string id)
	{
		_assets.TryGetValue(id, out var asset);
		return Task.FromResult(asset);
	}

	public Task UpsertAssetAsync(LoginImageAsset asset)
	{
		_assets[asset.Id] = asset;
		return Task.CompletedTask;
	}

	public Task<bool> DeleteAssetAsync(string id) =>
		Task.FromResult(_assets.TryRemove(id, out _));

	public Task<IReadOnlyList<LoginRule>> GetAllRulesAsync() =>
		Task.FromResult<IReadOnlyList<LoginRule>>(_rules.Values.ToList());

	public Task<LoginRule?> GetRuleAsync(string id)
	{
		_rules.TryGetValue(id, out var rule);
		return Task.FromResult(rule);
	}

	public Task UpsertRuleAsync(LoginRule rule)
	{
		_rules[rule.Id] = rule;
		return Task.CompletedTask;
	}

	public Task<bool> DeleteRuleAsync(string id) =>
		Task.FromResult(_rules.TryRemove(id, out _));

	public Task<LoginSettings> GetSettingsAsync() => Task.FromResult(_settings);

	public Task UpdateSettingsAsync(LoginSettings settings)
	{
		_settings = settings;
		return Task.CompletedTask;
	}

	// --- test seeding helpers ---

	public FakeLeLøginScreenStore WithAsset(LoginImageAsset asset)
	{
		_assets[asset.Id] = asset;
		return this;
	}

	public FakeLeLøginScreenStore WithRule(LoginRule rule)
	{
		_rules[rule.Id] = rule;
		return this;
	}

	public FakeLeLøginScreenStore WithSettings(LoginSettings settings)
	{
		_settings = settings;
		return this;
	}
}
