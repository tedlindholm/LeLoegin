using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Models;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
using Umbraco.Cms.Core.DependencyInjection;

[assembly: System.Runtime.CompilerServices.InternalsVisibleTo("LeLøgin.Tests")]

namespace LeLøgin.Core.Api;

/// <summary>
/// Registers the Login Screen OpenAPI document and its schema overrides.
/// </summary>
public static class ApiConfiguration
{
	public static IUmbracoBuilder AddLeLøginOpenApiDocument(this IUmbracoBuilder builder) =>
		builder.AddBackOfficeOpenApiDocument(
			ApiBase.LeLøginScreenApiName,
			document => document
				.WithTitle($"Løgin API v{ApiBase.Major}")
				.WithBackOfficeAuthentication()
				.ConfigureOpenApiOptions(ConfigureSchemas));

	private static void ConfigureSchemas(OpenApiOptions options) =>
		options.AddSchemaTransformer((schema, context, _) =>
		{
			ApplySchemaOverride(schema, context.JsonTypeInfo);
			return Task.CompletedTask;
		});

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
