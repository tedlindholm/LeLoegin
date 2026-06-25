using LeLøgin.Core.Storage;
using Umbraco.Cms.Core.IO;

namespace LeLøgin.Core;

public static class LeLøginBuilderExtensions
{
    /// <summary>
    /// Replaces the <see cref="IFileSystem"/> used for private asset and thumbnail storage
    /// (source uploads and WebP thumbnail cache).
    /// </summary>
    /// <remarks>
    /// Call this in a composer decorated with
    /// <c>[ComposeAfter(typeof(LeLøginScreenComposer))]</c> so it runs after the default
    /// <see cref="Umbraco.Cms.Core.IO.PhysicalFileSystem"/> is registered.
    /// </remarks>
    public static IUmbracoBuilder SetLoginAssetFileSystem(
        this IUmbracoBuilder builder,
        Func<IServiceProvider, IFileSystem> factory)
    {
        builder.Services.AddUnique<LeLøginAssetFileManager>(
            sp => new(factory(sp)));
        return builder;
    }

    /// <summary>
    /// Replaces the <see cref="IFileSystem"/> used for publicly-servable runtime
    /// publications (the JPEG / PNG / SVG files the login-background redirect points to).
    /// <see cref="IFileSystem.GetUrl"/> on this filesystem must return a publicly reachable
    /// URL — e.g. a blob storage URL when using Azure.
    /// </summary>
    /// <remarks>
    /// Call this in a composer decorated with
    /// <c>[ComposeAfter(typeof(LeLøginScreenComposer))]</c>.
    /// </remarks>
    public static IUmbracoBuilder SetLoginPublishFileSystem(
        this IUmbracoBuilder builder,
        Func<IServiceProvider, IFileSystem> factory)
    {
        builder.Services.AddUnique<LeLøginPublishFileManager>(
            sp => new(factory(sp)));
        return builder;
    }
}
