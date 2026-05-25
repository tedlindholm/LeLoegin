using Umbraco.Cms.Core.IO;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Holds the <see cref="IFileSystem"/> used for publicly-servable runtime publications
/// (the JPEG / PNG / SVG files the login-background redirect points to).
///
/// Replace the backing store by calling
/// <c>builder.SetLoginPublishFileSystem(factory => …)</c> in a composer decorated with
/// <c>[ComposeAfter(typeof(LeLøginScreenComposer))]</c>.
/// </summary>
public sealed class LeLøginPublishFileManager(IFileSystem fileSystem)
{
    public IFileSystem FileSystem { get; } = fileSystem;

    /// <summary>Returns the public URL for a published file by name.</summary>
    public string GetPublicUrl(string fileName) => FileSystem.GetUrl(fileName);
}
