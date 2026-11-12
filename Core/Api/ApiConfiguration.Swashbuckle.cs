using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;
using Umbraco.Cms.Api.Management.OpenApi;

namespace LeLøgin.Core.Api;

public static partial class ApiConfiguration
{
	/// <summary>
	/// Registers the Le Løgin Swagger document on Umbraco 17, with backoffice security requirements
	/// and the schema overrides from <see cref="ApplySchemaOverride"/>.
	/// </summary>
	/// <param name="builder">The Umbraco builder to register the document on.</param>
	/// <returns>The same <paramref name="builder"/>, for chaining.</returns>
	public static IUmbracoBuilder AddLeLøginOpenApiDocument(this IUmbracoBuilder builder)
	{
		builder.Services.ConfigureOptions<LeLøginSwaggerGenOptions>();
		return builder;
	}

	private sealed class LeLøginSwaggerGenOptions : IConfigureOptions<SwaggerGenOptions>, IPostConfigureOptions<SwaggerGenOptions>
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

			options.OperationFilter<LeLøginBackOfficeSecurityRequirementsOperationFilter>();
		}

		/// <summary>
		/// Runs after Umbraco's <c>EnumSchemaFilter</c>, which rewrites enums to their CLR names.
		/// The schema filter has to be added here so the wire values win.
		/// </summary>
		public void PostConfigure(string? name, SwaggerGenOptions options) =>
			options.SchemaFilter<LeLøginSwaggerSchemaFilter>();
	}

	private sealed class LeLøginBackOfficeSecurityRequirementsOperationFilter : BackOfficeSecurityRequirementsOperationFilterBase
	{
		protected override string ApiName => ApiBase.LeLøginScreenApiName;
	}

	/// <summary>
	/// Applies <see cref="ApplySchemaOverride"/> when Swashbuckle hands over a concrete schema.
	/// Reference schemas are left untouched.
	/// </summary>
	internal sealed class LeLøginSwaggerSchemaFilter : ISchemaFilter
	{
		/// <inheritdoc />
		public void Apply(IOpenApiSchema schema, SchemaFilterContext context) =>
			Apply(schema, context.Type);

		internal static void Apply(IOpenApiSchema schema, Type type)
		{
			if (schema is not OpenApiSchema openApiSchema)
			{
				return;
			}

			ApiConfiguration.ApplySchemaOverride(
				openApiSchema,
				JsonSerializerOptions.Default.GetTypeInfo(type));
		}
	}
}
