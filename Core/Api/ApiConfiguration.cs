using System.Text.Json.Nodes;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace LeLøgin.Core.Api;

/// <summary>
/// Registers the Login Screen Swagger document and security filter.
/// </summary>
public class ApiConfiguration : IConfigureOptions<SwaggerGenOptions>
{
	public void Configure(SwaggerGenOptions options)
	{
		options.SwaggerDoc(
			ApiBase.LeLøginScreenApiName,
			new OpenApiInfo
			{
				Title = $"Løgin API v{ApiBase.Major}",
				Version = ApiBase.LeLøginScreenApiVersion,
			});

		options.MapType<LoginRuleConditionValue>(() => new OpenApiSchema
		{
			OneOf =
			[
				new OpenApiSchema
				{
					Type = JsonSchemaType.String
				},
				new OpenApiSchema
				{
					Type = JsonSchemaType.Integer,
					Format = "int32"
				}
			]
		});

		options.MapType<LoginImageAssetKind>(() => CreateStringEnumSchema("background", "logo"));
		options.MapType<LoginRuleField>(() => CreateStringEnumSchema("weekday", "month"));
		options.MapType<LoginRuleConditionOperator>(() => CreateStringEnumSchema(
			"is", "isNot", "in", "notIn", "between", "notBetween"));
		options.MapType<LoginRuleConditionGroupOperator>(() => CreateStringEnumSchema("all", "any"));

		options.OperationFilter<ApiBase>();
	}

	private static OpenApiSchema CreateStringEnumSchema(params string[] values) => new()
	{
		Type = JsonSchemaType.String,
		Enum = values.Select(value => (JsonNode)JsonValue.Create(value)!).ToList()
	};
}
