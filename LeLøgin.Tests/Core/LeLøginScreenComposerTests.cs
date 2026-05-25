using LeLøgin.Core;
using LeLøgin.Core.Runtime;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Logging;
using Umbraco.Cms.Web.Common.ApplicationBuilder;
using Xunit;

namespace LeLøgin.Tests.Core;

public sealed class LeLøginScreenComposerTests
{
	[Fact]
	public void Compose_Does_Not_Register_Logo_Middleware_As_A_Service()
	{
		IServiceCollection services = new ServiceCollection();
		IUmbracoBuilder builder = new TestUmbracoBuilder(services);

		new LeLøginScreenComposer().Compose(builder);

		Assert.DoesNotContain(services, descriptor =>
			descriptor.ServiceType == typeof(LeLøginLogoMiddleware));
	}

	[Fact]
	public void Compose_Adds_Logo_Middleware_Pipeline_Filter()
	{
		IServiceCollection services = new ServiceCollection();
		IUmbracoBuilder builder = new TestUmbracoBuilder(services);

		new LeLøginScreenComposer().Compose(builder);

		using ServiceProvider provider = services.BuildServiceProvider();
		UmbracoPipelineOptions options = provider
			.GetRequiredService<IOptions<UmbracoPipelineOptions>>()
			.Value;
		IUmbracoPipelineFilter filter = Assert.Single(
			options.PipelineFilters,
			candidate => candidate.Name == nameof(LeLøginLogoMiddleware));
		UmbracoPipelineFilter concreteFilter = Assert.IsType<UmbracoPipelineFilter>(filter);

		Assert.NotNull(concreteFilter.PreRouting);
	}

	private sealed class TestUmbracoBuilder(IServiceCollection services) : IUmbracoBuilder
	{
		public IServiceCollection Services { get; } = services;

		public IConfiguration Config { get; } = new ConfigurationBuilder().Build();

		public TypeLoader TypeLoader => throw new NotSupportedException();

		public ILoggerFactory BuilderLoggerFactory { get; } = NullLoggerFactory.Instance;

		public IProfiler Profiler => throw new NotSupportedException();

		public AppCaches AppCaches => throw new NotSupportedException();

		TBuilder IUmbracoBuilder.WithCollectionBuilder<TBuilder>() => throw new NotSupportedException();

		public void Build()
		{
		}
	}
}