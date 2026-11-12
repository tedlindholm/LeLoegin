using LeLøgin.Core.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Umbraco.Cms.Core.Hosting;
using Umbraco.Cms.Core.IO;

namespace LeLøgin.Tests;

/// <summary>
/// Factory helpers that create <see cref="LeLøginAssetFileManager"/> and
/// <see cref="LeLøginPublishFileManager"/> backed by a real <see cref="PhysicalFileSystem"/>
/// rooted at a temp directory, for use in integration-style tests.
/// </summary>
internal static class TestFileSystems
{
    internal static LeLøginAssetFileManager AssetFileManager(string contentRootPath) =>
        new(BuildPhysicalFileSystem(
            rootPath: Path.Combine(contentRootPath, "App_Data", "LeLøgin"),
            rootUrl: "/App_Data/LeLøgin"));

    internal static LeLøginPublishFileManager PublishFileManager(string contentRootPath) =>
        new(BuildPhysicalFileSystem(
            rootPath: Path.Combine(contentRootPath, "wwwroot", "login-screen"),
            rootUrl: "/login-screen"));

    /// <summary>
    /// Asset file manager whose <c>GetFiles(path, filter)</c> behaves like
    /// <c>Umbraco.StorageProviders.AzureBlob</c> 17.1.0 and 18.0.0: a leading <c>*</c> is trimmed
    /// and the rest of the filter is matched as a literal substring, so glob patterns such as
    /// <c>id.*</c> match nothing.
    /// </summary>
    internal static LeLøginAssetFileManager BlobLikeAssetFileManager(string contentRootPath) =>
        new(new LiteralFilterFileSystem(AssetFileManager(contentRootPath).FileSystem));

    /// <inheritdoc cref="BlobLikeAssetFileManager"/>
    internal static LeLøginPublishFileManager BlobLikePublishFileManager(string contentRootPath) =>
        new(new LiteralFilterFileSystem(PublishFileManager(contentRootPath).FileSystem));

    internal sealed class LiteralFilterFileSystem(IFileSystem inner) : IFileSystem
    {
        public bool CanAddPhysical => inner.CanAddPhysical;
        public IEnumerable<string> GetDirectories(string path) => inner.GetDirectories(path);
        public void DeleteDirectory(string path) => inner.DeleteDirectory(path);
        public void DeleteDirectory(string path, bool recursive) => inner.DeleteDirectory(path, recursive);
        public bool DirectoryExists(string path) => inner.DirectoryExists(path);
        public void AddFile(string path, Stream stream) => inner.AddFile(path, stream);
        public void AddFile(string path, Stream stream, bool overrideIfExists) => inner.AddFile(path, stream, overrideIfExists);
        public IEnumerable<string> GetFiles(string path) => inner.GetFiles(path);

        public IEnumerable<string> GetFiles(string path, string filter)
        {
            var files = inner.GetFiles(path);
            if (string.IsNullOrEmpty(filter) || filter == "*.*")
            {
                return files;
            }

            var literal = filter.TrimStart('*');
            return files.Where(file => file.Contains(literal, StringComparison.OrdinalIgnoreCase));
        }

        public Stream OpenFile(string path) => inner.OpenFile(path);
        public void DeleteFile(string path) => inner.DeleteFile(path);
        public bool FileExists(string path) => inner.FileExists(path);
        public string GetRelativePath(string fullPathOrUrl) => inner.GetRelativePath(fullPathOrUrl);
        public string GetFullPath(string path) => inner.GetFullPath(path);
        public string GetUrl(string? path) => inner.GetUrl(path);
        public DateTimeOffset GetLastModified(string path) => inner.GetLastModified(path);
        public DateTimeOffset GetCreated(string path) => inner.GetCreated(path);
        public long GetSize(string path) => inner.GetSize(path);
        public void AddFile(string path, string physicalPath, bool overrideIfExists = true, bool copy = false) =>
            inner.AddFile(path, physicalPath, overrideIfExists, copy);
    }

    private static PhysicalFileSystem BuildPhysicalFileSystem(string rootPath, string rootUrl)
    {
        var ioHelper = new Mock<IIOHelper>();
        ioHelper
            .Setup(x => x.PathStartsWith(
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<char[]>()))
            .Returns((string path, string root, char[] seps) =>
            {
                if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                    return false;
                if (path.Length == root.Length)
                    return true;
                var sep = seps.Length > 0 ? seps[0] : Path.DirectorySeparatorChar;
                return path[root.Length] == sep;
            });

        return new PhysicalFileSystem(
            ioHelper.Object,
            new Mock<IHostingEnvironment>().Object,
            NullLogger<PhysicalFileSystem>.Instance,
            rootPath,
            rootUrl);
    }
}
