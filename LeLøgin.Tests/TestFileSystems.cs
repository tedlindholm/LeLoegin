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
            rootUrl: "/App_Data/LeLøgin",
            contentRootPath));

    internal static LeLøginPublishFileManager PublishFileManager(string contentRootPath) =>
        new(BuildPhysicalFileSystem(
            rootPath: Path.Combine(contentRootPath, "wwwroot", "login-screen"),
            rootUrl: "/login-screen",
            contentRootPath));

    private static PhysicalFileSystem BuildPhysicalFileSystem(
        string rootPath, string rootUrl, string contentRootPath)
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

        var hostingEnv = new Mock<IHostingEnvironment>();
        hostingEnv
            .Setup(x => x.MapPathContentRoot(It.IsAny<string>()))
            .Returns(contentRootPath);

        return new PhysicalFileSystem(
            ioHelper.Object,
            hostingEnv.Object,
            NullLogger<PhysicalFileSystem>.Instance,
            rootPath,
            rootUrl);
    }
}
