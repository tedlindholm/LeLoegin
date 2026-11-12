using Microsoft.AspNetCore.OpenApi;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;

namespace LeLøgin.Core.Api;

public static partial class ApiConfiguration
{
	/// <summary>
	/// Registers the Le Løgin OpenAPI document on Umbraco 18, with backoffice authentication and
	/// the schema overrides from <see cref="ApplySchemaOverride"/>.
	/// </summary>
	/// <param name="builder">The Umbraco builder to register the document on.</param>
	/// <returns>The same <paramref name="builder"/>, for chaining.</returns>
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
}
