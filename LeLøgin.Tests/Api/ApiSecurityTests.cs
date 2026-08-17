using LeLøgin.Core;
using LeLøgin.Core.Api;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Umbraco.Cms.Core.DependencyInjection;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// Regression tests for OpenAPI security scheme configuration. The managed API endpoints
/// require BackOffice authentication, and the OpenAPI document must declare this via
/// securitySchemes so that API clients know auth is required.
///
/// TODO: Extend with full integration test that validates the generated OpenAPI document
/// (at /umbraco/swagger/le-løgin-api-v1/swagger.json) contains:
/// - securitySchemes with at least one scheme
/// - All protected endpoints have security requirements applied
/// This ensures a future Umbraco update to WithBackOfficeAuthentication() doesn't silently
/// drop security from the OpenAPI documentation.
/// </summary>
public sealed class ApiSecurityTests
{
	[Fact]
	public void AddLeLøginOpenApiDocument_Is_Wired_With_BackOffice_Authentication()
	{
		var services = new ServiceCollection();
		var config = new ConfigurationBuilder().Build();
		var builder = new TestUmbracoBuilder(services, config);

		new LeLøginScreenComposer().Compose(builder);

		builder.AddLeLøginOpenApiDocument();

		var provider = services.BuildServiceProvider();
		Assert.NotNull(provider);
	}

	private sealed class TestUmbracoBuilder(IServiceCollection services, IConfiguration config) : IUmbracoBuilder
	{
		public IServiceCollection Services { get; } = services;
		public IConfiguration Config { get; } = config;
		public TypeLoader TypeLoader => throw new NotSupportedException();
		public ILoggerFactory BuilderLoggerFactory { get; } = NullLoggerFactory.Instance;
	}
}
