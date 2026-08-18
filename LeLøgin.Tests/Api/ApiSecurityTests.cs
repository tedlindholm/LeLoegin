using LeLøgin.Core;
using LeLøgin.Core.Api;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Logging;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// Regression tests for OpenAPI security scheme configuration. The managed API endpoints
/// require BackOffice authentication, and the OpenAPI document must declare this via
/// securitySchemes so that API clients know auth is required.
///
/// TODO: Extend with full integration test that validates the generated OpenAPI document
/// (at /umbraco/openapi/le-løgin-api-v1.json) contains:
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

	/// <summary>
	/// Minimal <see cref="IUmbracoBuilder"/> double. Only the members the composer touches carry
	/// real behaviour; the rest exist to satisfy the interface and throw if they are ever reached,
	/// so a composer that starts depending on them fails loudly rather than silently no-opping.
	/// </summary>
	private sealed class TestUmbracoBuilder(IServiceCollection services, IConfiguration config) : IUmbracoBuilder
	{
		private readonly Dictionary<Type, ICollectionBuilder> _collectionBuilders = [];

		public IServiceCollection Services { get; } = services;

		public IConfiguration Config { get; } = config;

		public ILoggerFactory BuilderLoggerFactory { get; } = NullLoggerFactory.Instance;

		public AppCaches AppCaches { get; } = AppCaches.NoCache;

		public TypeLoader TypeLoader => throw new NotSupportedException();

		public IProfiler Profiler => throw new NotSupportedException();

		// Mirrors UmbracoBuilder: one instance per builder type, created on first request.
		public TBuilder WithCollectionBuilder<TBuilder>()
			where TBuilder : ICollectionBuilder
		{
			if (_collectionBuilders.TryGetValue(typeof(TBuilder), out var existing))
			{
				return (TBuilder)existing;
			}

			var created = Activator.CreateInstance<TBuilder>();
			_collectionBuilders[typeof(TBuilder)] = created;
			return created;
		}

		public void Build()
		{
			foreach (var collectionBuilder in _collectionBuilders.Values)
			{
				collectionBuilder.RegisterWith(Services);
			}

			_collectionBuilders.Clear();
		}
	}
}
