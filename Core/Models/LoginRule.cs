using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace LeLøgin.Core.Models;

/// <summary>
/// A login screen rule. Evaluated in priority order; first matching rule wins. When the matching
/// rule references more than one image, one of <see cref="AssetIds"/> is shown at random.
/// </summary>
public sealed class LoginRule
{
	public required string Id { get; set; }
	public required string Name { get; set; }
	public bool Enabled { get; set; } = true;
	public int Priority { get; set; }

	/// <summary>
	/// A JsonLogic condition expression, stored as raw JSON. Use <c>"true"</c> for an always-match
	/// fallback — this is how a <c>random</c> rule (no date conditions, multiple images) is stored.
	/// Stored as a string because JsonFlatFileDataStore (Newtonsoft) cannot round-trip <see cref="System.Text.Json.JsonElement"/>.
	/// Legacy persisted object tokens are normalised back to compact JSON during deserialisation.
	/// </summary>
	[JsonConverter(typeof(LoginRuleConditionNewtonsoftJsonConverter))]
	public required string Condition { get; set; }

	/// <summary>
	/// The image(s) this rule can show. <c>all</c>/<c>any</c> rules hold exactly one; a <c>random</c>
	/// rule holds one or more, and the resolver picks one at random each time the rule matches.
	/// </summary>
	public required IReadOnlyList<string> AssetIds { get; set; }
}

/// <summary>
/// Normalises persisted rule conditions so JsonFlatFileDataStore can read both the canonical string payload
/// and legacy object-backed payloads written by older implementations.
/// </summary>
public sealed class LoginRuleConditionNewtonsoftJsonConverter : JsonConverter<string>
{
	public override string ReadJson(
		JsonReader reader,
		Type objectType,
		string? existingValue,
		bool hasExistingValue,
		JsonSerializer serializer)
	{
		return reader.TokenType switch
		{
			JsonToken.Null => string.Empty,
			JsonToken.String => reader.Value as string ?? string.Empty,
			_ => JToken.ReadFrom(reader).ToString(Formatting.None)
		};
	}

	public override void WriteJson(JsonWriter writer, string? value, JsonSerializer serializer) =>
		writer.WriteValue(value);
}
