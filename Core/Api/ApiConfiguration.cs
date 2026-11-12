using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Text.Json.Nodes;
using LeLøgin.Core.Api.Assets;
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
	/// Describes models whose custom converters or constructor annotations the generators cannot read.
	/// Anything else is left untouched.
	/// </summary>
	internal static void ApplySchemaOverride(OpenApiSchema schema, JsonTypeInfo typeInfo)
	{
		var type = typeInfo.Type;

		if (type == typeof(AssetUpdateRequest))
		{
			ApplyAssetUpdateLengths(schema);
		}
		else if (type == typeof(LoginImageAssetKind))
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

	// Both generators read property annotations, but MVC requires these on record constructor parameters.
	private static void ApplyAssetUpdateLengths(OpenApiSchema schema)
	{
		if (schema.Properties is null) return;

		foreach (var parameter in typeof(AssetUpdateRequest).GetConstructors().Single().GetParameters())
		{
			if (parameter.GetCustomAttribute<MaxLengthAttribute>() is not { } maximum) continue;
			var property = schema.Properties.FirstOrDefault(property =>
				string.Equals(property.Key, parameter.Name, StringComparison.OrdinalIgnoreCase));
			if (property.Value is OpenApiSchema propertySchema)
			{
				propertySchema.MaxLength = maximum.Length;
			}
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
