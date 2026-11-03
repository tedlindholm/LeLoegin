using System.Text.Json.Nodes;
using LeLøgin.Core.Api;
using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Moq;
using Swashbuckle.AspNetCore.SwaggerGen;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// Umbraco 17 describes the document through Swashbuckle. These tests pin the cast into
/// <see cref="OpenApiSchema"/> and the document name the host publishes.
/// </summary>
public sealed class ApiConfigurationSwashbuckleTests
{
	[Fact]
	public void Schema_Filter_Describes_LoginImageAssetKind_As_A_String_Enum()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.LeLøginSwaggerSchemaFilter.Apply(schema, typeof(LoginImageAssetKind));

		Assert.Equal(JsonSchemaType.String, schema.Type);
		Assert.Equal(["background", "logo"], EnumValuesOf(schema));
	}

	[Fact]
	public void Schema_Filter_Describes_Condition_Value_Items_As_String_Or_Integer()
	{
		var schema = new OpenApiSchema();

		ApiConfiguration.LeLøginSwaggerSchemaFilter.Apply(schema, typeof(IReadOnlyList<LoginRuleConditionValue>));

		var items = Assert.IsType<OpenApiSchema>(schema.Items);
		Assert.Collection(
			items.OneOf!,
			text => Assert.Equal(JsonSchemaType.String, Assert.IsType<OpenApiSchema>(text).Type),
			number =>
			{
				var integer = Assert.IsType<OpenApiSchema>(number);
				Assert.Equal(JsonSchemaType.Integer, integer.Type);
				Assert.Equal("int32", integer.Format);
			});
	}

	[Fact]
	public void Schema_Filter_Leaves_A_Reference_Schema_Untouched()
	{
		var schema = new Mock<IOpenApiSchema>().Object;

		ApiConfiguration.LeLøginSwaggerSchemaFilter.Apply(schema, typeof(LoginImageAssetKind));

		Mock.Get(schema).VerifyNoOtherCalls();
	}

	[Fact]
	public void AddLeLøginOpenApiDocument_Registers_The_Swagger_Document()
	{
		var services = new ServiceCollection();
		new ServicesOnlyBuilder(services).AddLeLøginOpenApiDocument();

		using var provider = services.BuildServiceProvider();
		var options = new SwaggerGenOptions();
		foreach (var configure in provider.GetServices<IConfigureOptions<SwaggerGenOptions>>())
		{
			configure.Configure(options);
		}

		foreach (var postConfigure in provider.GetServices<IPostConfigureOptions<SwaggerGenOptions>>())
		{
			postConfigure.PostConfigure(null, options);
		}

		Assert.Contains(ApiBase.LeLøginScreenApiName, options.SwaggerGeneratorOptions.SwaggerDocs.Keys);
		Assert.Contains(
			options.SchemaFilterDescriptors,
			descriptor => descriptor.Type == typeof(ApiConfiguration.LeLøginSwaggerSchemaFilter));
	}

	private static IEnumerable<string> EnumValuesOf(OpenApiSchema schema) =>
		(schema.Enum ?? []).Select(node => node!.GetValue<string>());

	private sealed class ServicesOnlyBuilder(IServiceCollection services) : Umbraco.Cms.Core.DependencyInjection.IUmbracoBuilder
	{
		public IServiceCollection Services { get; } = services;

		public Microsoft.Extensions.Configuration.IConfiguration Config =>
			throw new NotSupportedException();

		public Microsoft.Extensions.Logging.ILoggerFactory BuilderLoggerFactory =>
			throw new NotSupportedException();

		public Umbraco.Cms.Core.Cache.AppCaches AppCaches =>
			throw new NotSupportedException();

		public Umbraco.Cms.Core.Composing.TypeLoader TypeLoader =>
			throw new NotSupportedException();

		public Umbraco.Cms.Core.Logging.IProfiler Profiler =>
			throw new NotSupportedException();

		public TBuilder WithCollectionBuilder<TBuilder>()
			where TBuilder : Umbraco.Cms.Core.Composing.ICollectionBuilder =>
			throw new NotSupportedException();

		public void Build() => throw new NotSupportedException();
	}
}
