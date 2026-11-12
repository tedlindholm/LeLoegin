using System.Text.Json;
using System.Text.Json.Serialization;

namespace LeLøgin.Core.Models;

/// <summary>
/// Known asset kinds used by Le Løgin.
/// </summary>
[JsonConverter(typeof(LoginImageAssetKindJsonConverter))]
public enum LoginImageAssetKind
{
	/// <summary>A full-screen login background image; serialised as <c>background</c>.</summary>
	Background,

	/// <summary>A login logo image; serialised as <c>logo</c>.</summary>
	Logo
}

/// <summary>
/// Serialises <see cref="LoginImageAssetKind"/> using the lowercase public contract values.
/// </summary>
public sealed class LoginImageAssetKindJsonConverter : JsonConverter<LoginImageAssetKind>
{
	/// <inheritdoc />
	/// <exception cref="JsonException">The value is not <c>background</c> or <c>logo</c> (case-insensitive).</exception>
	public override LoginImageAssetKind Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
	{
		var value = reader.GetString();
		return value?.ToLowerInvariant() switch
		{
			"background" => LoginImageAssetKind.Background,
			"logo" => LoginImageAssetKind.Logo,
			_ => throw new JsonException($"Unsupported login image asset kind '{value}'.")
		};
	}

	/// <inheritdoc />
	/// <exception cref="JsonException"><paramref name="value"/> is not a defined kind.</exception>
	public override void Write(Utf8JsonWriter writer, LoginImageAssetKind value, JsonSerializerOptions options)
	{
		writer.WriteStringValue(value switch
		{
			LoginImageAssetKind.Background => "background",
			LoginImageAssetKind.Logo => "logo",
			_ => throw new JsonException($"Unsupported login image asset kind '{value}'.")
		});
	}
}
