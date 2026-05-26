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
    /// <exception cref="InvalidOperationException">
    /// The backing file system returned a null URL — typically a sign that the publish
    /// file system is not configured with a non-empty root URL. Surfacing it as an
    /// exception lets the runtime controller's catch block fall through to
    /// <c>NoContent</c> rather than emitting a 200 response with a null <c>imageUrl</c>
    /// that the client cannot parse.
    /// </exception>
    public string GetPublicUrl(string fileName) =>
        FileSystem.GetUrl(fileName)
        ?? throw new InvalidOperationException(
            $"The publish file system returned a null URL for '{fileName}'. " +
            "Check that the publish file system is configured with a non-empty root URL.");
}
