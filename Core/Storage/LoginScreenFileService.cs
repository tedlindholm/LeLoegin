using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using LeLøgin.Core.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;
using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using System.Xml.Linq;

namespace LeLøgin.Core.Storage;

/// <summary>
/// File service backed by <see cref="LeLøginAssetFileManager"/> and
/// <see cref="LeLøginPublishFileManager"/>. All paths are filesystem-relative to their
/// respective manager roots — no absolute paths are used or stored.
/// </summary>
public sealed class LeLøginScreenFileService(
    LeLøginAssetFileManager assetManager,
    LeLøginPublishFileManager publishManager,
    ILogger<LeLøginScreenFileService> logger) : ILeLøginScreenFileService
{
    private const string AssetsPrefix = "assets/";
    private const string ThumbnailsPrefix = "thumbnails/";
    // 1280 covers 2× DPR at the editor's typical preview width (~640 CSS px). Larger
    // just bloats the response without showing more pixels. Quality 75 is the visual
    // sweet spot for WebP on photographic content — perceptually indistinguishable
    // from the source at the editor's display size.
    private const int ThumbnailMaxDimension = 1280;
    private const int ThumbnailWebpQuality = 75;

    public async Task<(string storagePath, int width, int height)> SaveUploadAsync(string assetId, IFormFile file)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{assetId}{extension}";
        var relativePath = $"{AssetsPrefix}{fileName}";

        if (extension.Equals(".svg", StringComparison.OrdinalIgnoreCase))
        {
            using var raw = new MemoryStream();
            await file.CopyToAsync(raw);
            raw.Position = 0;

            using var sanitised = SanitiseSvg(raw);
            assetManager.FileSystem.AddFile(relativePath, sanitised);

            sanitised.Position = 0;
            var (width, height) = ReadSvgDimensions(sanitised);
            return (relativePath, width, height);
        }

        using var stream = file.OpenReadStream();
        assetManager.FileSystem.AddFile(relativePath, stream);

        using var opened = assetManager.FileSystem.OpenFile(relativePath);
        using var image = await Image.LoadAsync(opened);
        return (relativePath, width: image.Width, height: image.Height);
    }

    public void DeleteAsset(string assetId)
    {
        foreach (var relativePath in assetManager.FileSystem.GetFiles(AssetsPrefix.TrimEnd('/'), $"{assetId}.*"))
        {
            assetManager.FileSystem.DeleteFile(relativePath);
        }
    }

    public async Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(LoginImageAsset imageAsset)
    {
        var imageFileName = CreateRuntimeImageFileName(imageAsset);

        try
        {
            await PublishImageIfMissingAsync(imageAsset.StoragePath, imageFileName);
            PruneStalePublications(imageFileName);
            return new PublishedRuntimeAssetPaths(publishManager.GetPublicUrl(imageFileName));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create runtime publication for asset {AssetId}", imageAsset.Id);
            throw;
        }
    }

    public async Task<EncodedThumbnail> GetThumbnailAsync(LoginImageAsset asset)
    {
        var sourcePath = asset.StoragePath;
        if (!assetManager.FileSystem.FileExists(sourcePath))
        {
            throw new FileNotFoundException("Source file is missing.", sourcePath);
        }

        // SVG sources skip the WebP path: they're vector and already tiny, and
        // rasterising them would lose the scalability that's the whole point.
        if (IsSvgPath(sourcePath))
        {
            return new EncodedThumbnail(
                sourcePath,
                "image/svg+xml",
                assetManager.FileSystem.GetLastModified(sourcePath).UtcDateTime);
        }

        var sourceMtime = assetManager.FileSystem.GetLastModified(sourcePath);
        var cacheFileName = $"{ThumbnailsPrefix}{asset.Id}-{sourceMtime.UtcTicks.ToString(CultureInfo.InvariantCulture)}.webp";

        if (!assetManager.FileSystem.FileExists(cacheFileName))
        {
            // Stale entries for this asset are wasted disc space and confuse future
            // debugging — prune them before writing the new one.
            PruneStaleThumbnails(asset.Id, cacheFileName);
            await EncodeWebpThumbnailAsync(sourcePath, cacheFileName);
        }

        return new EncodedThumbnail(
            cacheFileName,
            "image/webp",
            assetManager.FileSystem.GetLastModified(cacheFileName).UtcDateTime);
    }

    private void PruneStalePublications(string keepImageFileName)
    {
        try
        {
            foreach (var existing in publishManager.FileSystem.GetFiles(""))
            {
                if (!string.Equals(existing, keepImageFileName, StringComparison.OrdinalIgnoreCase))
                {
                    publishManager.FileSystem.DeleteFile(existing);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to prune stale runtime publications.");
        }
    }

    private void PruneStaleThumbnails(string assetId, string keepCacheFileName)
    {
        try
        {
            foreach (var existing in assetManager.FileSystem.GetFiles(ThumbnailsPrefix.TrimEnd('/'), $"{assetId}-*.webp"))
            {
                if (!string.Equals(existing, keepCacheFileName, StringComparison.OrdinalIgnoreCase))
                {
                    assetManager.FileSystem.DeleteFile(existing);
                }
            }
        }
        catch (Exception ex)
        {
            // Pruning is best-effort cleanup; failure here must not block thumbnail
            // generation. Surface it for visibility.
            logger.LogWarning(ex, "Failed to prune stale thumbnails for asset {AssetId}", assetId);
        }
    }

    private async Task EncodeWebpThumbnailAsync(string sourcePath, string cacheFileName)
    {
        using var sourceStream = assetManager.FileSystem.OpenFile(sourcePath);
        using var image = await Image.LoadAsync(sourceStream);
        image.Mutate(op => op.Resize(new ResizeOptions
        {
            Mode = ResizeMode.Max,
            Size = new Size(ThumbnailMaxDimension, ThumbnailMaxDimension)
        }));
        using var encoded = new MemoryStream();
        await image.SaveAsWebpAsync(encoded, new WebpEncoder { Quality = ThumbnailWebpQuality });
        encoded.Position = 0;
        assetManager.FileSystem.AddFile(cacheFileName, encoded);
    }

    private static string CreateRuntimeImageFileName(LoginImageAsset imageAsset)
    {
        var exposureId = CreateDeterministicExposureId(imageAsset).ToString("N");
        return $"{exposureId}.jpg";
    }

    private async Task PublishImageIfMissingAsync(string storagePath, string publishFileName)
    {
        if (publishManager.FileSystem.FileExists(publishFileName))
        {
            return;
        }

        using var sourceStream = assetManager.FileSystem.OpenFile(storagePath);
        using var image = await Image.LoadAsync(sourceStream);
        using var encoded = new MemoryStream();
        await image.SaveAsJpegAsync(encoded);
        encoded.Position = 0;
        publishManager.FileSystem.AddFile(publishFileName, encoded);
    }

    private static Guid CreateDeterministicExposureId(LoginImageAsset imageAsset)
    {
        var seed = $"{imageAsset.Id}|{imageAsset.UpdatedAt.ToUniversalTime().Ticks.ToString(CultureInfo.InvariantCulture)}";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(seed));
        Span<byte> guidBytes = stackalloc byte[16];
        hash.AsSpan(0, 16).CopyTo(guidBytes);
        return new Guid(guidBytes);
    }

    private static bool IsSvgPath(string path) =>
        Path.GetExtension(path).Equals(".svg", StringComparison.OrdinalIgnoreCase);

    private static (int width, int height) ReadSvgDimensions(Stream stream)
    {
        var document = XDocument.Load(stream);
        var root = document.Root;
        if (root is null)
            return (0, 0);

        var width = ParseSvgLength(root.Attribute("width")?.Value);
        var height = ParseSvgLength(root.Attribute("height")?.Value);

        if (width > 0 && height > 0)
            return (width, height);

        var viewBoxValue = root.Attribute("viewBox")?.Value;
        if (viewBoxValue is null)
            return (width, height);

        var viewBoxParts = viewBoxValue
            .Split([' ', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (viewBoxParts.Length != 4)
            return (width, height);

        var viewBoxWidth = ParseSvgNumber(viewBoxParts[2]);
        var viewBoxHeight = ParseSvgNumber(viewBoxParts[3]);

        return (width > 0 ? width : viewBoxWidth, height > 0 ? height : viewBoxHeight);
    }

    private static MemoryStream SanitiseSvg(Stream input)
    {
        var document = XDocument.Load(input);

        var scripts = document.Descendants()
            .Where(e => e.Name.LocalName.Equals("script", StringComparison.OrdinalIgnoreCase))
            .ToList();
        foreach (var script in scripts)
        {
            script.Remove();
        }

        foreach (var element in document.Descendants())
        {
            var dangerous = element.Attributes().Where(IsUnsafeAttribute).ToList();
            foreach (var attr in dangerous)
                attr.Remove();
        }

        var output = new MemoryStream();
        document.Save(output, SaveOptions.None);
        output.Position = 0;
        return output;
    }

    private static bool IsUnsafeAttribute(XAttribute attr)
    {
        var name = attr.Name.LocalName;
        if (name.StartsWith("on", StringComparison.OrdinalIgnoreCase))
            return true;
        if (name is "href" or "src" or "action" or "formaction")
            return attr.Value.TrimStart().StartsWith("javascript:", StringComparison.OrdinalIgnoreCase);
        return false;
    }

    private static int ParseSvgLength(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return 0;
        }

        var numeric = new string(value
            .Trim()
            .TakeWhile(character => char.IsAsciiDigit(character) || character is '.' or '-')
            .ToArray());

        return ParseSvgNumber(numeric);
    }

    private static int ParseSvgNumber(string? value)
    {
        if (!double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
        {
            return 0;
        }

        return number <= 0 ? 0 : (int)Math.Round(number, MidpointRounding.AwayFromZero);
    }

}
