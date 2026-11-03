using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Models;
using Microsoft.OpenApi;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("LeLøgin.Tests")]

namespace LeLøgin.Core.Api;

/// <summary>
/// Schema overrides shared by the Umbraco 18 OpenAPI registration and the Umbraco 17 Swashbuckle registration.
/// </summary>
public static partial class ApiConfiguration
{
	/// <summary>
	/// Describes the models whose custom <see cref="System.Text.Json.Serialization.JsonConverter"/>s
	/// hide their wire shape from the generator. Anything else is left untouched.
	/// </summary>
	internal static void ApplySchemaOverride(OpenApiSchema schema, JsonTypeInfo typeInfo)
	{
		var type = typeInfo.Type;

		if (type == typeof(LoginImageAssetKind))
		{
			ApplyStringEnum(schema, "background", "logo");
		}
		else if (type == typeof(LoginRuleField))
		{
			ApplyStringEnum(schema, "weekday", "month");
		}
		else if (type == typeof(LoginRuleConditionOperator))
		{
			ApplyStringEnum(schema, "is", "isNot", "in", "notIn", "between", "notBetween");
		}
		else if (type == typeof(LoginRuleConditionGroupOperator))
		{
			ApplyStringEnum(schema, "all", "any");
		}
		else if (typeInfo.ElementType == typeof(LoginRuleConditionValue))
		{
			// Matched via typeInfo.ElementType — i.e. on the collection, not on the value type.
			// The generator walks the collection but never descends into the element, because
			// the element's converter leaves its JsonTypeInfo opaque. Match instead on
			// type == typeof(LoginRuleConditionValue) and this override never fires: `values`
			// then ships as a bare array with no items, and no build or startup breaks to say so.
			schema.Items = CreateStringOrIntegerSchema();
		}
	}

	private static OpenApiSchema CreateStringOrIntegerSchema() => new()
	{
		OneOf =
		[
			new OpenApiSchema { Type = JsonSchemaType.String },
			new OpenApiSchema { Type = JsonSchemaType.Integer, Format = "int32" }
		]
	};

	private static void ApplyStringEnum(OpenApiSchema schema, params string[] values)
	{
		schema.Type = JsonSchemaType.String;
		schema.Format = null;
		schema.Enum = values.Select(value => (JsonNode)JsonValue.Create(value)!).ToList();
	}
}
