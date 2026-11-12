using LeLøgin.Core.Storage;
using IWebHostEnvironment = Microsoft.AspNetCore.Hosting.IWebHostEnvironment;
using Microsoft.Extensions.FileProviders;
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
	public void AddAzureBlobLoginFileSystems_Registers_Pipeline_Filter_That_Mounts_The_Publish_File_System()
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
		// The package mounts the publish file system on the web root. The assets file system is
		// private (streamed by authenticated endpoints, never linked) and must not be mounted.
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

	[Theory]
	[InlineData(AzureBlobLoginFileSystemsExtensions.AssetsFileSystemName, "/configured/assets")]
	[InlineData(AzureBlobLoginFileSystemsExtensions.PublishFileSystemName, "/configured/publish")]
	public void AddAzureBlobLoginFileSystems_Keeps_A_VirtualPath_Set_In_Configuration(string fileSystemName, string virtualPath)
	{
		IServiceCollection services = BuildServicesWithMinimalBlobConfig(new Dictionary<string, string?>
		{
			[$"Umbraco:Storage:AzureBlob:{fileSystemName}:VirtualPath"] = virtualPath,
		});
		IUmbracoBuilder builder = new TestUmbracoBuilder(
			services,
			services.BuildServiceProvider().GetRequiredService<IConfiguration>());

		builder.AddAzureBlobLoginFileSystems();

		using ServiceProvider provider = services.BuildServiceProvider();
		AzureBlobFileSystemOptions options = provider
			.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>()
			.Get(fileSystemName);
		Assert.Equal(virtualPath, options.VirtualPath);
	}

	[Fact]
	public void MountOnWebRoot_Serves_Published_Files_Under_The_Virtual_Path_Alongside_The_Web_Root()
	{
		// Mirrors Umbraco's UseUmbracoMediaFileProvider: once published images are part of the web
		// root, ImageSharp's WebRootImageProvider can crop them and static files can serve them.
		var root = Path.Combine(Path.GetTempPath(), "LeLøgin.AzureBlob.Tests", Guid.NewGuid().ToString("N"));
		var webRoot = Directory.CreateDirectory(Path.Combine(root, "wwwroot")).FullName;
		var publishRoot = Directory.CreateDirectory(Path.Combine(root, "publish")).FullName;
		File.WriteAllText(Path.Combine(webRoot, "site.css"), "body {}");
		File.WriteAllText(Path.Combine(publishRoot, "0123.jpg"), "jpeg");
		try
		{
			var environment = new TestWebHostEnvironment { WebRootFileProvider = new PhysicalFileProvider(webRoot) };
			var publishFileSystem = new PhysicalFileSystem(
				Mock.Of<IIOHelper>(),
				Mock.Of<IHostingEnvironment>(),
				NullLogger<PhysicalFileSystem>.Instance,
				publishRoot,
				"/le-login/publish");

			var mounted = AzureBlobLoginFileSystemsExtensions.MountOnWebRoot(environment, publishFileSystem, "/le-login/publish/");

			Assert.True(mounted);
			Assert.True(environment.WebRootFileProvider.GetFileInfo("/le-login/publish/0123.jpg").Exists);
			Assert.False(environment.WebRootFileProvider.GetFileInfo("/le-login/publish/missing.jpg").Exists);
			Assert.True(environment.WebRootFileProvider.GetFileInfo("/site.css").Exists);
		}
		finally
		{
			Directory.Delete(root, recursive: true);
		}
	}

	private sealed class TestWebHostEnvironment : IWebHostEnvironment
	{
		public string WebRootPath { get; set; } = string.Empty;
		public required IFileProvider WebRootFileProvider { get; set; }
		public string ApplicationName { get; set; } = "LeLøgin.AzureBlob.Tests";
		public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
		public string ContentRootPath { get; set; } = string.Empty;
		public string EnvironmentName { get; set; } = "Development";
	}

	private static IServiceCollection BuildServicesWithMinimalBlobConfig(IReadOnlyDictionary<string, string?>? extraSettings = null)
	{
		IServiceCollection services = new ServiceCollection();
		IConfiguration configuration = new ConfigurationBuilder()
			.AddInMemoryCollection(extraSettings ?? new Dictionary<string, string?>())
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
