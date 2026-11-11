using LeLøgin.Core.Api.Assets;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Security;

namespace LeLøgin.Tests.Api.Assets;

/// <summary>Runs uploads against the real file service and an isolated temporary asset directory.</summary>
internal sealed class UploadTestContext : IDisposable
{
    public string Root { get; } = Path.Combine(Path.GetTempPath(), "LeLøgin.UploadTests", Guid.NewGuid().ToString("N"));
    public FakeLeLøginScreenStore Store { get; } = new();

    public AssetController CreateController() => new(
        Store,
        new LeLøginScreenFileService(TestFileSystems.AssetFileManager(Root), TestFileSystems.PublishFileManager(Root),
            NullLogger<LeLøginScreenFileService>.Instance),
        new AcceptFile(), new ContentOptions(), TestFileSystems.AssetFileManager(Root), NullLogger<AssetController>.Instance);

    public void Dispose()
    {
        if (Directory.Exists(Root)) Directory.Delete(Root, recursive: true);
    }

    private sealed class AcceptFile : IFileStreamSecurityValidator
    {
        public bool IsConsideredSafe(Stream stream) => true;
    }

    private sealed class ContentOptions : IOptionsMonitor<ContentSettings>
    {
        public ContentSettings CurrentValue { get; } = new();
        public ContentSettings Get(string? name) => CurrentValue;
        public IDisposable? OnChange(Action<ContentSettings, string?> listener) => null;
    }
}
