using Umbraco.Cms.Core.IO;

namespace LeLøgin.Core.Storage;

/// <summary>
/// Holds the <see cref="IFileSystem"/> used for private asset and thumbnail storage
/// (source uploads under <c>assets/</c> and cached WebP thumbnails under <c>thumbnails/</c>,
/// both relative to the registered root).
///
/// Replace the backing store by calling
/// <c>builder.SetLoginAssetFileSystem(factory => …)</c> in a composer decorated with
/// <c>[ComposeAfter(typeof(LeLøginScreenComposer))]</c>.
/// </summary>
public sealed class LeLøginAssetFileManager(IFileSystem fileSystem)
{
    public IFileSystem FileSystem { get; } = fileSystem;
}
