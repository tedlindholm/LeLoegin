using System.Text.Json;
using System.Text.Json.Serialization;

namespace LeLøgin.Core.Models;

/// <summary>
/// Known asset kinds used by Le Løgin.
/// </summary>
[JsonConverter(typeof(LoginImageAssetKindJsonConverter))]
public enum LoginImageAssetKind
{
	Background,

	Logo
}

/// <summary>
/// Serialises <see cref="LoginImageAssetKind"/> using the lowercase public contract values.
/// </summary>
public sealed class LoginImageAssetKindJsonConverter : JsonConverter<LoginImageAssetKind>
{
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
