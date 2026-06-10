using System.Text.Json;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Single source of truth for how a rule's image ids are stored — a JSON array of strings in the
/// <c>LeLoginRules.AssetIds</c> column. Shared by the store and the data-preserving migration so the
/// on-disk shape (and the legacy single-id → list conversion) is defined in exactly one place.
/// </summary>
public static class RuleAssetIdsSerialiser
{
	/// <summary>Serialises the asset ids to a JSON array string for persistence.</summary>
	public static string Serialise(IReadOnlyList<string>? assetIds) =>
		JsonSerializer.Serialize(assetIds ?? []);

	/// <summary>
	/// Reads the stored JSON array back into a list. Tolerates null/empty (→ empty list) and a
	/// bare single id that predates the JSON-array shape (→ one-element list).
	/// </summary>
	public static IReadOnlyList<string> Deserialise(string? stored)
	{
		if (string.IsNullOrWhiteSpace(stored))
		{
			return [];
		}

		try
		{
			return JsonSerializer.Deserialize<List<string>>(stored) ?? [];
		}
		catch (JsonException)
		{
			// A legacy, not-yet-migrated bare id (e.g. "asset-1") — treat it as a single-element list.
			return [stored];
		}
	}

	/// <summary>
	/// Converts a legacy single <c>AssetId</c> value into the new JSON array shape. An empty/blank id
	/// becomes an empty array. Used by the migration to backfill existing rows without data loss.
	/// </summary>
	public static string FromLegacyAssetId(string? legacyAssetId) =>
		Serialise(string.IsNullOrWhiteSpace(legacyAssetId) ? [] : [legacyAssetId]);
}
