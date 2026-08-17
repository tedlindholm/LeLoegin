using LeLøgin.Core.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.Cms.Core.Cache;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.Hosting;
using Umbraco.Cms.Core.IO;
using Umbraco.Cms.Core.Logging;
using Umbraco.Cms.Web.Common.ApplicationBuilder;
using Umbraco.StorageProviders.AzureBlob.IO;
using Xunit;

namespace LeLøgin.AzureBlob.Tests;

public sealed class AzureBlobLoginFileSystemsExtensionsTests
{
	[Fact]
	public void AddAzureBlobLoginFileSystems_Swaps_Asset_And_Publish_Managers_To_Blob_Backed_File_Systems()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		LeLøginAssetFileManager assetManager = provider.GetRequiredService<LeLøginAssetFileManager>();
		LeLøginPublishFileManager publishManager = provider.GetRequiredService<LeLøginPublishFileManager>();

		Assert.IsAssignableFrom<IAzureBlobFileSystem>(assetManager.FileSystem);
		Assert.IsAssignableFrom<IAzureBlobFileSystem>(publishManager.FileSystem);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Registers_Azure_Blob_File_System_Provider()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		Assert.Contains(services, d => d.ServiceType == typeof(IAzureBlobFileSystemProvider));
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Sets_Default_VirtualPath_For_Assets_When_Config_Omits_It()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		AzureBlobFileSystemOptions options = provider
			.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>()
			.Get(AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName);

		Assert.Equal("/le-login/assets", options.VirtualPath);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Sets_Default_VirtualPath_For_Publish_When_Config_Omits_It()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		AzureBlobFileSystemOptions options = provider
			.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>()
			.Get(AzureBlobLoginFileSystemsExtensions.PublishFileSystemName);

		Assert.Equal("/le-login/publish", options.VirtualPath);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Invokes_Consumer_Configure_For_Assets_After_Defaults()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems(
			configureAssets: options => options.VirtualPath = "/custom/assets",
			configurePublish: _ => { });

		using ServiceProvider provider = services.BuildServiceProvider();
		AzureBlobFileSystemOptions options = provider
			.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>()
			.Get(AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName);

		Assert.Equal("/custom/assets", options.VirtualPath);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Invokes_Consumer_Configure_For_Publish_After_Defaults()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems(
			configureAssets: _ => { },
			configurePublish: options => options.VirtualPath = "/custom/publish");

		using ServiceProvider provider = services.BuildServiceProvider();
		AzureBlobFileSystemOptions options = provider
			.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>()
			.Get(AzureBlobLoginFileSystemsExtensions.PublishFileSystemName);

		Assert.Equal("/custom/publish", options.VirtualPath);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Lets_Consumer_Replace_BlobContainerClient_Factory_For_Managed_Identity()
	{
		IServiceCollection services = new ServiceCollection();
		IConfiguration configuration = new ConfigurationBuilder()
			.AddInMemoryCollection(new Dictionary<string, string?>
			{
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName}:ConnectionString"] = "https://example.blob.core.windows.net/",
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName}:ContainerName"] = "login",
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.PublishFileSystemName}:ConnectionString"] = "https://example.blob.core.windows.net/",
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.PublishFileSystemName}:ContainerName"] = "login",
			})
			.Build();
		services.AddSingleton(configuration);
		services.AddSingleton(Mock.Of<IHostingEnvironment>());
		services.AddSingleton(Mock.Of<IIOHelper>());

		IUmbracoBuilder builder = new TestUmbracoBuilder(services, configuration);

		int assetsConfigureCallCount = 0;
		int publishConfigureCallCount = 0;
		builder.AddAzureBlobLoginFileSystems(
			configureAssets: options =>
			{
				assetsConfigureCallCount++;
				Assert.Equal("https://example.blob.core.windows.net/", options.ConnectionString);
			},
			configurePublish: options =>
			{
				publishConfigureCallCount++;
				Assert.Equal("https://example.blob.core.windows.net/", options.ConnectionString);
			});

		using ServiceProvider provider = services.BuildServiceProvider();
		IOptionsMonitor<AzureBlobFileSystemOptions> monitor =
			provider.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>();
		_ = monitor.Get(AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName);
		_ = monitor.Get(AzureBlobLoginFileSystemsExtensions.PublishFileSystemName);

		Assert.Equal(1, assetsConfigureCallCount);
		Assert.Equal(1, publishConfigureCallCount);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Registers_Pipeline_Filter_For_Publish_Static_Files()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		UmbracoPipelineOptions pipelineOptions = provider
			.GetRequiredService<IOptions<UmbracoPipelineOptions>>()
			.Value;
		IUmbracoPipelineFilter filter = Assert.Single(
			pipelineOptions.PipelineFilters,
			candidate => candidate.Name == AzureBlobLoginFileSystemsExtensions.PipelineFilterName);
		UmbracoPipelineFilter concreteFilter = Assert.IsType<UmbracoPipelineFilter>(filter);
		Assert.NotNull(concreteFilter.PreRouting);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Publish_FileSystem_Is_File_Provider_Factory()
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		LeLøginPublishFileManager publishManager = provider.GetRequiredService<LeLøginPublishFileManager>();

		Assert.IsAssignableFrom<IFileProviderFactory>(publishManager.FileSystem);
	}

	[Fact]
	public void AddAzureBlobLoginFileSystems_Registers_Exactly_One_Pipeline_Filter()
	{
		// The package mounts the publish file system as static files. The assets
		// file system is private (served via AssetController.Preview, never via URL)
		// and must not appear in the static-files pipeline.
		IServiceCollection services = BuildServicesWithMinimalBlobConfig();
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		UmbracoPipelineOptions pipelineOptions = provider
			.GetRequiredService<IOptions<UmbracoPipelineOptions>>()
			.Value;
		var packageFilters = pipelineOptions.PipelineFilters
			.Where(f => f.Name.Contains("LeLøginAzureBlob", StringComparison.Ordinal))
			.ToList();

		Assert.Single(packageFilters);
	}

	private static IServiceCollection BuildServicesWithMinimalBlobConfig()
	{
		IServiceCollection services = new ServiceCollection();
		IConfiguration configuration = new ConfigurationBuilder()
			.AddInMemoryCollection(new Dictionary<string, string?>
			{
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName}:ConnectionString"] = "UseDevelopmentStorage=true",
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName}:ContainerName"] = "login",
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.PublishFileSystemName}:ConnectionString"] = "UseDevelopmentStorage=true",
				[$"Umbraco:Storage:AzureBlob:{AzureBlobLoginFileSystemsExtensions.PublishFileSystemName}:ContainerName"] = "login",
			})
			.Build();
		services.AddSingleton(configuration);
		Mock<IHostingEnvironment> hostingEnvironment = new();
		hostingEnvironment
			.Setup(env => env.ToAbsolute(It.IsAny<string>()))
			.Returns<string>(virtualPath => virtualPath);
		services.AddSingleton(hostingEnvironment.Object);
		services.AddSingleton(Mock.Of<IIOHelper>());
		return services;
	}

	private sealed class TestUmbracoBuilder(IServiceCollection services, IConfiguration configuration) : IUmbracoBuilder
	{
		public IServiceCollection Services { get; } = services;

		public IConfiguration Config { get; } = configuration;

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
