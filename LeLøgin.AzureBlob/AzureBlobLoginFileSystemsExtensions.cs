using LeLøgin.Core;
using Microsoft.Extensions.DependencyInjection;
using Umbraco.Cms.Core.DependencyInjection;
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

        return builder;
    }
}
