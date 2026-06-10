using LeLøgin.Core.Models;
using LeLøgin.Core.Storage.Dtos;
using Umbraco.Cms.Infrastructure.Scoping;

namespace LeLøgin.Core.Storage;

/// <summary>
/// NPoco-backed implementation of <see cref="ILeLøginScreenStore"/>. Reads and writes
/// the Umbraco database via <see cref="IScopeProvider"/>; durable across deploys and
/// safe under multi-instance hosting because the database handles concurrency.
/// </summary>
public sealed class LeLøginScreenStore : ILeLøginScreenStore
{
	private readonly IScopeProvider _scopeProvider;

	public LeLøginScreenStore(IScopeProvider scopeProvider)
	{
		_scopeProvider = scopeProvider;
	}

	public async Task<IReadOnlyList<LoginImageAsset>> GetAllAssetsAsync()
	{
		using var scope = _scopeProvider.CreateScope();
		var dtos = await scope.Database.FetchAsync<LeLoginAssetDto>();
		scope.Complete();
		return dtos.Select(MapToDomain).ToList();
	}

	public async Task<LoginImageAsset?> GetAssetAsync(string id)
	{
		ArgumentNullException.ThrowIfNull(id);
		using var scope = _scopeProvider.CreateScope();
		var dto = await scope.Database.SingleOrDefaultByIdAsync<LeLoginAssetDto>(id);
		scope.Complete();
		return dto is null ? null : MapToDomain(dto);
	}

	public async Task UpsertAssetAsync(LoginImageAsset asset)
	{
		ArgumentNullException.ThrowIfNull(asset);
		using var scope = _scopeProvider.CreateScope();
		var dto = MapToDto(asset);
		var existing = await scope.Database.SingleOrDefaultByIdAsync<LeLoginAssetDto>(asset.Id);
		if (existing is null)
		{
			await scope.Database.InsertAsync(dto);
		}
		else
		{
			await scope.Database.UpdateAsync(dto);
		}
		scope.Complete();
	}

	public async Task<bool> DeleteAssetAsync(string id)
	{
		ArgumentNullException.ThrowIfNull(id);
		using var scope = _scopeProvider.CreateScope();
		var existing = await scope.Database.SingleOrDefaultByIdAsync<LeLoginAssetDto>(id);
		if (existing is null)
		{
			scope.Complete();
			return false;
		}
		await scope.Database.DeleteAsync(existing);
		scope.Complete();
		return true;
	}

	public async Task<IReadOnlyList<LoginRule>> GetAllRulesAsync()
	{
		using var scope = _scopeProvider.CreateScope();
		var dtos = await scope.Database.FetchAsync<LeLoginRuleDto>();
		scope.Complete();
		return dtos.Select(MapToDomain).ToList();
	}

	public async Task<LoginRule?> GetRuleAsync(string id)
	{
		ArgumentNullException.ThrowIfNull(id);
		using var scope = _scopeProvider.CreateScope();
		var dto = await scope.Database.SingleOrDefaultByIdAsync<LeLoginRuleDto>(id);
		scope.Complete();
		return dto is null ? null : MapToDomain(dto);
	}

	public async Task UpsertRuleAsync(LoginRule rule)
	{
		ArgumentNullException.ThrowIfNull(rule);
		using var scope = _scopeProvider.CreateScope();
		var dto = MapToDto(rule);
		var existing = await scope.Database.SingleOrDefaultByIdAsync<LeLoginRuleDto>(rule.Id);
		if (existing is null)
		{
			await scope.Database.InsertAsync(dto);
		}
		else
		{
			await scope.Database.UpdateAsync(dto);
		}
		scope.Complete();
	}

	public async Task<bool> DeleteRuleAsync(string id)
	{
		ArgumentNullException.ThrowIfNull(id);
		using var scope = _scopeProvider.CreateScope();
		var existing = await scope.Database.SingleOrDefaultByIdAsync<LeLoginRuleDto>(id);
		if (existing is null)
		{
			scope.Complete();
			return false;
		}
		await scope.Database.DeleteAsync(existing);
		scope.Complete();
		return true;
	}

	public async Task<LoginSettings> GetSettingsAsync()
	{
		using var scope = _scopeProvider.CreateScope();
		var dto = await scope.Database.SingleOrDefaultByIdAsync<LeLoginSettingsDto>(LeLoginSettingsDto.SingletonId);
		scope.Complete();
		return dto is null
			? new LoginSettings()
			: new LoginSettings { PublicEndpointCacheSeconds = dto.PublicEndpointCacheSeconds };
	}

	public async Task UpdateSettingsAsync(LoginSettings settings)
	{
		ArgumentNullException.ThrowIfNull(settings);
		using var scope = _scopeProvider.CreateScope();
		var existing = await scope.Database.SingleOrDefaultByIdAsync<LeLoginSettingsDto>(LeLoginSettingsDto.SingletonId);
		var dto = new LeLoginSettingsDto
		{
			Id = LeLoginSettingsDto.SingletonId,
			PublicEndpointCacheSeconds = settings.PublicEndpointCacheSeconds
		};
		if (existing is null)
		{
			await scope.Database.InsertAsync(dto);
		}
		else
		{
			await scope.Database.UpdateAsync(dto);
		}
		scope.Complete();
	}

	private static LoginImageAsset MapToDomain(LeLoginAssetDto dto) => new()
	{
		Id = dto.Id,
		Name = dto.Name,
		Kind = ParseKind(dto.Kind),
		AltText = dto.AltText,
		GreetingText = dto.GreetingText,
		LogoAssetId = dto.LogoAssetId,
		StoragePath = dto.StoragePath,
		PublicPath = dto.PublicPath,
		Width = dto.Width,
		Height = dto.Height,
		FocalPoint = dto.FocalPointLeft.HasValue && dto.FocalPointTop.HasValue
			? new FocalPoint { Left = dto.FocalPointLeft.Value, Top = dto.FocalPointTop.Value }
			: null,
		Zoom = dto.Zoom,
		CreatedAt = DateTime.SpecifyKind(dto.CreatedAt, DateTimeKind.Utc),
		UpdatedAt = DateTime.SpecifyKind(dto.UpdatedAt, DateTimeKind.Utc)
	};

	private static LeLoginAssetDto MapToDto(LoginImageAsset asset) => new()
	{
		Id = asset.Id,
		Name = asset.Name,
		Kind = SerialiseKind(asset.Kind),
		AltText = asset.AltText,
		GreetingText = asset.GreetingText,
		LogoAssetId = asset.LogoAssetId,
		StoragePath = asset.StoragePath,
		PublicPath = asset.PublicPath,
		Width = asset.Width,
		Height = asset.Height,
		FocalPointLeft = asset.FocalPoint?.Left,
		FocalPointTop = asset.FocalPoint?.Top,
		Zoom = asset.Zoom,
		CreatedAt = asset.CreatedAt,
		UpdatedAt = asset.UpdatedAt
	};

	private static LoginRule MapToDomain(LeLoginRuleDto dto) => new()
	{
		Id = dto.Id,
		Name = dto.Name,
		Enabled = dto.Enabled,
		Priority = dto.Priority,
		Condition = dto.Condition,
		AssetIds = RuleAssetIdsSerializer.Deserialize(dto.AssetIds)
	};

	private static LeLoginRuleDto MapToDto(LoginRule rule) => new()
	{
		Id = rule.Id,
		Name = rule.Name,
		Enabled = rule.Enabled,
		Priority = rule.Priority,
		Condition = rule.Condition,
		AssetIds = RuleAssetIdsSerializer.Serialize(rule.AssetIds)
	};

	private static LoginImageAssetKind ParseKind(string value) => value.ToLowerInvariant() switch
	{
		"logo" => LoginImageAssetKind.Logo,
		_ => LoginImageAssetKind.Background
	};

	private static string SerialiseKind(LoginImageAssetKind kind) => kind switch
	{
		LoginImageAssetKind.Logo => "logo",
		_ => "background"
	};
}
