using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Serialization;
using LeLøgin.Core.Models;

namespace LeLøgin.Tests.Storage;

/// <summary>
/// Test helper that seeds a <see cref="FakeLeLøginScreenStore"/> from the legacy
/// <c>config.json</c> shape so existing controller/middleware tests can keep their
/// inline JSON fixtures intact during the 1.0.x → 1.1.0 store rewrite.
///
/// Lenient: accepts both the integer-backed <c>kind</c> values written by the original
/// JsonFlatFileDataStore (0 = Background, 1 = Logo) and the lowercase strings emitted
/// by the System.Text.Json converter ("background" / "logo").
/// </summary>
internal static class FakeLeLøginScreenStoreSeed
{
	public static FakeLeLøginScreenStore FromConfigJson(string json)
	{
		var legacy = JsonSerializer.Deserialize<LegacyConfig>(json, Options)
			?? new LegacyConfig();
		var store = new FakeLeLøginScreenStore();
		foreach (var asset in legacy.Assets ?? [])
		{
			if (string.IsNullOrWhiteSpace(asset.Id) || string.IsNullOrWhiteSpace(asset.Name) || string.IsNullOrWhiteSpace(asset.StoragePath))
			{
				continue;
			}
			store.WithAsset(new LoginImageAsset
			{
				Id = asset.Id,
				Name = asset.Name,
				Kind = ParseKind(asset.Kind),
				AltText = asset.AltText,
				GreetingText = asset.GreetingText,
				LogoAssetId = asset.LogoAssetId,
				StoragePath = asset.StoragePath,
				PublicPath = asset.PublicPath,
				Width = asset.Width,
				Height = asset.Height,
				FocalPoint = asset.FocalPoint,
				Zoom = asset.Zoom == 0.0 ? 1.0 : asset.Zoom,
				CreatedAt = asset.CreatedAt == default ? DateTime.UtcNow : asset.CreatedAt,
				UpdatedAt = asset.UpdatedAt == default ? DateTime.UtcNow : asset.UpdatedAt
			});
		}
		foreach (var rule in legacy.Rules ?? [])
		{
			if (string.IsNullOrWhiteSpace(rule.Id) || string.IsNullOrWhiteSpace(rule.Name) || string.IsNullOrWhiteSpace(rule.AssetId))
			{
				continue;
			}
			store.WithRule(new LoginRule
			{
				Id = rule.Id,
				Name = rule.Name,
				Enabled = rule.Enabled,
				Priority = rule.Priority,
				Condition = rule.Condition ?? string.Empty,
				// Legacy fixtures carry a single assetId; mirror the migration's single-id → list conversion.
				AssetIds = [rule.AssetId]
			});
		}
		if (legacy.Settings is not null)
		{
			store.WithSettings(new LoginSettings
			{
				PublicEndpointCacheSeconds = legacy.Settings.PublicEndpointCacheSeconds == 0
					? 300
					: legacy.Settings.PublicEndpointCacheSeconds
			});
		}
		return store;
	}

	private static LoginImageAssetKind ParseKind(JsonElement? kind)
	{
		if (kind is null || kind.Value.ValueKind == JsonValueKind.Null)
		{
			return LoginImageAssetKind.Background;
		}
		return kind.Value.ValueKind switch
		{
			JsonValueKind.Number => kind.Value.GetInt32() switch
			{
				1 => LoginImageAssetKind.Logo,
				_ => LoginImageAssetKind.Background
			},
			JsonValueKind.String => kind.Value.GetString()?.ToLowerInvariant() switch
			{
				"logo" => LoginImageAssetKind.Logo,
				_ => LoginImageAssetKind.Background
			},
			_ => LoginImageAssetKind.Background
		};
	}

	private static readonly JsonSerializerOptions Options = new()
	{
		PropertyNameCaseInsensitive = true,
		DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
	};

	[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by System.Text.Json via reflection.")]
	private sealed class LegacyConfig
	{
		public List<LegacyAsset>? Assets { get; set; }
		public List<LegacyRule>? Rules { get; set; }
		public LegacySettings? Settings { get; set; }
	}

	[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by System.Text.Json via reflection.")]
	private sealed class LegacyAsset
	{
		public string? Id { get; set; }
		public string? Name { get; set; }
		public JsonElement? Kind { get; set; }
		public string? AltText { get; set; }
		public string? GreetingText { get; set; }
		public string? LogoAssetId { get; set; }
		public string? StoragePath { get; set; }
		public string? PublicPath { get; set; }
		public int Width { get; set; }
		public int Height { get; set; }
		public FocalPoint? FocalPoint { get; set; }
		public double Zoom { get; set; }
		public DateTime CreatedAt { get; set; }
		public DateTime UpdatedAt { get; set; }
	}

	[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by System.Text.Json via reflection.")]
	private sealed class LegacyRule
	{
		public string? Id { get; set; }
		public string? Name { get; set; }
		public bool Enabled { get; set; } = true;
		public int Priority { get; set; }
		public string? Condition { get; set; }
		public string? AssetId { get; set; }
	}

	[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by System.Text.Json via reflection.")]
	private sealed class LegacySettings
	{
		public int PublicEndpointCacheSeconds { get; set; }
	}
}
