using Dazinator.Extensions.FileProviders.PrependBasePath;
using LeLøgin.Core;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.IO;
using Umbraco.Cms.Web.Common.ApplicationBuilder;
using Umbraco.Extensions;
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
    /// Configuration is read from <c>Umbraco:Storage:AzureBlob:LeLoginAssets</c>.
    /// </summary>
    public const string AssetsFileSystemName = "LeLoginAssets";

    /// <summary>
    /// Name of the Azure Blob file system holding publicly-served runtime publications.
    /// Configuration is read from <c>Umbraco:Storage:AzureBlob:LeLoginPublish</c>.
    /// </summary>
    public const string PublishFileSystemName = "LeLoginPublish";

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
    /// Also mounts the publish file system on the web root so its URLs are served as static files.
    /// </summary>
    /// <param name="builder">The Umbraco builder.</param>
    /// <returns>The same <paramref name="builder"/>, for chaining.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="builder"/> is <see langword="null"/>.</exception>
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
    /// Also mounts the publish file system on the web root so its URLs are served as static files.
    /// </summary>
    /// <param name="builder">The Umbraco builder.</param>
    /// <param name="configureAssets">Configures the <see cref="AssetsFileSystemName"/> options after binding and the default virtual path.</param>
    /// <param name="configurePublish">Configures the <see cref="PublishFileSystemName"/> options after binding and the default virtual path.</param>
    /// <returns>The same <paramref name="builder"/>, for chaining.</returns>
    /// <exception cref="ArgumentNullException">Any argument is <see langword="null"/>.</exception>
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
        // Configuration binds before these callbacks run, so only fill in a path it left empty.
        builder.AddAzureBlobFileSystem(AssetsFileSystemName, options =>
        {
            if (string.IsNullOrEmpty(options.VirtualPath)) options.VirtualPath = DefaultAssetsVirtualPath;
            configureAssets?.Invoke(options);
        });

        builder.AddAzureBlobFileSystem(PublishFileSystemName, options =>
        {
            if (string.IsNullOrEmpty(options.VirtualPath)) options.VirtualPath = DefaultPublishVirtualPath;
            configurePublish?.Invoke(options);
        });

        builder.SetLoginAssetFileSystem(sp =>
            sp.GetRequiredService<IAzureBlobFileSystemProvider>().GetFileSystem(AssetsFileSystemName));

        builder.SetLoginPublishFileSystem(sp =>
            sp.GetRequiredService<IAzureBlobFileSystemProvider>().GetFileSystem(PublishFileSystemName));

        // Make the publish file system part of the web root at its VirtualPath, as Umbraco's
        // UseUmbracoMediaFileProvider does for media on blob storage. Its GetUrl() returns URLs
        // beneath that path (e.g. /le-login/publish/<guid>.jpg). Once mounted, Umbraco's own
        // static-files middleware serves those URLs, and ImageSharp's WebRootImageProvider can
        // apply the focal-point and zoom crop in their query string. Both read the web root's file
        // provider when the pipeline is built, after every filter has run, so mounting here is in
        // time. The asset file system is NOT mounted: it is private (thumbnails and previews are
        // streamed by authenticated endpoints, never linked).
        builder.Services.Configure<UmbracoPipelineOptions>(pipelineOptions =>
        {
            pipelineOptions.AddFilter(new UmbracoPipelineFilter(PipelineFilterName)
            {
                PreRouting = app =>
                {
                    var publishFileSystem = app.ApplicationServices
                        .GetRequiredService<IAzureBlobFileSystemProvider>()
                        .GetFileSystem(PublishFileSystemName);
                    var publishOptions = app.ApplicationServices
                        .GetRequiredService<IOptionsMonitor<AzureBlobFileSystemOptions>>()
                        .Get(PublishFileSystemName);

                    MountOnWebRoot(
                        app.ApplicationServices.GetRequiredService<IWebHostEnvironment>(),
                        publishFileSystem,
                        publishOptions.VirtualPath ?? DefaultPublishVirtualPath);
                }
            });
        });

        return builder;
    }

    /// <summary>
    /// Adds <paramref name="fileSystem"/> to the web root under <paramref name="virtualPath"/>,
    /// the way Umbraco's <c>UseUmbracoMediaFileProvider</c> adds media. Uses Umbraco's
    /// <see cref="FileSystemExtensions.TryCreateFileProvider"/> and the
    /// <see cref="PrependBasePathFileProvider"/> Umbraco uses to mount <c>/App_Plugins</c>.
    /// Umbraco's media variant of that provider only differs in handling special characters in
    /// file names, which published <c>&lt;guid&gt;.jpg</c> names never contain.
    /// </summary>
    /// <param name="environment">The host environment whose <see cref="IWebHostEnvironment.WebRootFileProvider"/> is replaced.</param>
    /// <param name="fileSystem">The file system to mount.</param>
    /// <param name="virtualPath">The web path to mount it under; a trailing slash is ignored.</param>
    /// <returns><c>true</c> when mounted; <c>false</c> when the file system cannot provide an <see cref="IFileProvider"/>.</returns>
    internal static bool MountOnWebRoot(IWebHostEnvironment environment, IFileSystem fileSystem, string virtualPath)
    {
        if (!fileSystem.TryCreateFileProvider(out var fileProvider))
        {
            return false;
        }

        environment.WebRootFileProvider = new CompositeFileProvider(
            environment.WebRootFileProvider,
            new PrependBasePathFileProvider(virtualPath.TrimEnd('/'), fileProvider));
        return true;
    }
}
