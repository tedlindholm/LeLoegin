using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// The part of the OpenAPI document both Umbraco generators must describe the same way.
/// Nullability spelling, numeric string unions, and <c>required</c> membership stay out of it.
/// </summary>
internal static class OpenApiSharedContract
{
	private static readonly JsonSerializerOptions CanonicalJson = new()
	{
		Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
		WriteIndented = true
	};

	private static readonly string[] IgnoredSchemas = ["IFormFile", "LoginRuleConditionValue"];

	public static void AssertMatchesFixture(JsonNode document, string fixturePath)
	{
		var expected = JsonNode.Parse(File.ReadAllText(fixturePath))
			?? throw new InvalidOperationException($"The shared contract fixture at {fixturePath} is empty.");
		var actual = FromDocument(document);
		Assert.Equal(Canonical(expected), Canonical(actual));
	}

	internal static JsonObject FromDocument(JsonNode document)
	{
		var schemas = document["components"]?["schemas"]?.AsObject()
			?? throw new InvalidOperationException("The OpenAPI document has no component schemas.");
		var conditionModel = schemas["LoginRuleConditionModel"]
			?? throw new InvalidOperationException("The OpenAPI document has no LoginRuleConditionModel schema.");
		var oneOf = conditionModel["properties"]?["values"]?["items"]?["oneOf"]?.AsArray()
			?? throw new InvalidOperationException("The condition value schema has no oneOf items.");

		var contractSchemas = new JsonObject();
		foreach (var schema in schemas.OrderBy(schema => schema.Key, StringComparer.Ordinal))
		{
			if (IgnoredSchemas.Contains(schema.Key, StringComparer.Ordinal) || schema.Value is null)
			{
				continue;
			}

			var entry = new JsonObject();
			if (schema.Value["enum"] is JsonArray enumValues)
			{
				entry["enum"] = new JsonArray(enumValues.Select(value => JsonValue.Create(value!.GetValue<string>())).ToArray());
			}

			if (schema.Value["properties"] is JsonObject properties)
			{
				var names = properties.Select(property => JsonValue.Create(property.Key) as JsonNode).OrderBy(name => name!.GetValue<string>(), StringComparer.Ordinal);
				entry["properties"] = new JsonArray(names.ToArray());
			}

			contractSchemas[schema.Key] = entry;
		}

		return new JsonObject
		{
			["paths"] = new JsonArray(PathNames(document).Select(path => JsonValue.Create(path) as JsonNode).ToArray()),
			["conditionValueOneOf"] = new JsonArray(ConditionValueSchemas(oneOf).ToArray()),
			["schemas"] = contractSchemas
		};
	}

	private static IEnumerable<string> PathNames(JsonNode document)
	{
		var paths = document["paths"]?.AsObject()
			?? throw new InvalidOperationException("The OpenAPI document has no paths.");
		return paths.Select(path => path.Key).OrderBy(path => path, StringComparer.Ordinal);
	}

	private static IEnumerable<JsonNode> ConditionValueSchemas(JsonArray oneOf) =>
		oneOf
			.Select(ConditionValueSchema)
			.OrderBy(schema => schema["type"]!.GetValue<string>(), StringComparer.Ordinal);

	private static JsonObject ConditionValueSchema(JsonNode? item)
	{
		var schema = item as JsonObject
			?? throw new InvalidOperationException("A condition value oneOf entry is missing.");
		var result = new JsonObject
		{
			["type"] = schema["type"]?.GetValue<string>()
				?? throw new InvalidOperationException("A condition value oneOf entry has no type.")
		};
		if (schema["format"]?.GetValue<string>() is string format)
		{
			result["format"] = format;
		}

		return result;
	}

	private static string Canonical(JsonNode node) => node.ToJsonString(CanonicalJson);
}
