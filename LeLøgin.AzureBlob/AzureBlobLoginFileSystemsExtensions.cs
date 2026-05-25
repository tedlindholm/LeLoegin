using LeLøgin.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.DependencyInjection;
using Umbraco.Cms.Core.IO;
using Umbraco.Cms.Web.Common.ApplicationBuilder;
using Umbraco.StorageProviders.AzureBlob.IO;

namespace LeLøgin.AzureBlob;

/// <summary>
/// Registers Azure Blob Storage as the backing file system for Le Løgin's asset and publish stores.
/// Layered on top of <c>Umbraco.StorageProviders.AzureBlob</c>; Le Løgin core stays free of any Azure dependency.
/// </summary>
public static class AzureBlobLoginFileSystemsExtensions
{
    /// <summary>
    /// Name of the Azure Blob file system holding private uploads and thumbnail cache.
    /// Configuration is read from <c>Umbraco:Storage:AzureBlob:LeLøginAssets</c>.
    /// </summary>
    public const string AssetsFileSystemName = "LeLøginAssets";

    /// <summary>
    /// Name of the Azure Blob file system holding publicly-served runtime publications.
    /// Configuration is read from <c>Umbraco:Storage:AzureBlob:LeLøginPublish</c>.
    /// </summary>
    public const string PublishFileSystemName = "LeLøginPublish";

    /// <summary>
    /// Default <see cref="AzureBlobFileSystemOptions.VirtualPath"/> for the assets file system.
    /// Applied after configuration binding and before any consumer configure callback.
    /// </summary>
    public const string DefaultAssetsVirtualPath = "/le-login/assets";

    /// <summary>
    /// Default <see cref="AzureBlobFileSystemOptions.VirtualPath"/> for the publish file system.
    /// Applied after configuration binding and before any consumer configure callback.
    /// </summary>
    public const string DefaultPublishVirtualPath = "/le-login/publish";

    /// <summary>
    /// Name of the <see cref="UmbracoPipelineFilter"/> the extension registers to serve the publish
    /// file system as static files. Exposed so tests can locate the filter and so consumers can
    /// reason about pipeline ordering.
    /// </summary>
    public const string PipelineFilterName = "LeLøginAzureBlobPublishStaticFiles";

    /// <summary>
    /// Routes Le Løgin's asset and publish file systems through Azure Blob Storage using the
    /// default <see cref="BlobContainerClient"/> factory, which requires a literal storage connection string.
    /// For managed-identity or other URI-based credentials use the overload that accepts configure callbacks
    /// and call <see cref="AzureBlobFileSystemOptionsExtensions.TryCreateBlobContainerClientUsingUri"/>.
    /// </summary>
    public static IUmbracoBuilder AddAzureBlobLoginFileSystems(this IUmbracoBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);
        return AddInternal(builder, configureAssets: null, configurePublish: null);
    }

    /// <summary>
    /// Routes Le Løgin's asset and publish file systems through Azure Blob Storage and runs the
    /// supplied callbacks against each named <see cref="AzureBlobFileSystemOptions"/> instance after
    /// configuration binding. Use this overload to wire a custom <see cref="BlobContainerClient"/>
    /// factory — e.g. <see cref="AzureBlobFileSystemOptionsExtensions.TryCreateBlobContainerClientUsingUri"/>
    /// with <c>DefaultAzureCredential</c> for managed identity.
    /// </summary>
    public static IUmbracoBuilder AddAzureBlobLoginFileSystems(
        this IUmbracoBuilder builder,
        Action<AzureBlobFileSystemOptions> configureAssets,
        Action<AzureBlobFileSystemOptions> configurePublish)
    {
        ArgumentNullException.ThrowIfNull(builder);
        ArgumentNullException.ThrowIfNull(configureAssets);
        ArgumentNullException.ThrowIfNull(configurePublish);
        return AddInternal(builder, configureAssets, configurePublish);
    }

    private static IUmbracoBuilder AddInternal(
        IUmbracoBuilder builder,
        Action<AzureBlobFileSystemOptions>? configureAssets,
        Action<AzureBlobFileSystemOptions>? configurePublish)
    {
        builder.AddAzureBlobFileSystem(AssetsFileSystemName, options =>
        {
            options.VirtualPath = DefaultAssetsVirtualPath;
            configureAssets?.Invoke(options);
        });

        builder.AddAzureBlobFileSystem(PublishFileSystemName, options =>
        {
            options.VirtualPath = DefaultPublishVirtualPath;
            configurePublish?.Invoke(options);
        });

        builder.SetLoginAssetFileSystem(sp =>
            sp.GetRequiredService<IAzureBlobFileSystemProvider>().GetFileSystem(AssetsFileSystemName));

        builder.SetLoginPublishFileSystem(sp =>
            sp.GetRequiredService<IAzureBlobFileSystemProvider>().GetFileSystem(PublishFileSystemName));

        // Mount the publish file system as static files at its configured VirtualPath.
        // The publish FS's IFileSystem.GetUrl() returns a relative URL beneath that path
        // (e.g. /le-login/publish/<guid>.jpg); with the physical default that path lives under
        // wwwroot and is served by Umbraco's default UseStaticFiles. With blob storage there
        // is no wwwroot mapping, so we register a second static-files middleware pointing at
        // the blob's IFileProvider for that virtual path. Asset FS is NOT mounted — it's
        // private (AssetController.Preview streams via OpenFile, never returns a URL).
        builder.Services.Configure<UmbracoPipelineOptions>(pipelineOptions =>
        {
            pipelineOptions.AddFilter(new UmbracoPipelineFilter(PipelineFilterName)
            {
                PreRouting = app =>
                {
                    var blobProvider = app.ApplicationServices.GetRequiredService<IAzureBlobFileSystemProvider>();
                    var publishFileSystem = blobProvider.GetFileSystem(PublishFileSystemName);
                    if (publishFileSystem is not IFileProviderFactory factory)
                    {
                        return;
                    }

                    var optionsMonitor = app.ApplicationServices.GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>();
                    var publishOptions = optionsMonitor.Get(PublishFileSystemName);
                    var requestPath = (publishOptions.VirtualPath ?? DefaultPublishVirtualPath).TrimEnd('/');

                    app.UseStaticFiles(new StaticFileOptions
                    {
                        FileProvider = factory.Create(),
                        RequestPath = requestPath
                    });
                }
            });
        });

        return builder;
    }
}
