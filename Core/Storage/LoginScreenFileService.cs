using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using LeLøgin.Core.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Webp;
using SixLabors.ImageSharp.Processing;
using System.Security.Cryptography;
using System.Text;
using System.Globalization;
using System.Xml;
using System.Xml.Linq;

namespace LeLøgin.Core.Storage;

/// <summary>
/// File service backed by <see cref="LeLøginAssetFileManager"/> and
/// <see cref="LeLøginPublishFileManager"/>. All paths are filesystem-relative to their
/// respective manager roots — no absolute paths are used or stored.
/// </summary>
/// <param name="assetManager">Private storage for source assets and thumbnails.</param>
/// <param name="publishManager">Public storage for runtime publications.</param>
/// <param name="logger">Logger for publishing and clean-up failures.</param>
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
    /// <summary>Maximum decoded pixel count accepted for raster images (25 MP).</summary>
    internal const long MaxImagePixels = 25_000_000;

    /// <inheritdoc />
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
        using var image = await LoadBoundedImageAsync(stream);
        using var validatedStream = file.OpenReadStream();
        assetManager.FileSystem.AddFile(relativePath, validatedStream);
        return (relativePath, width: image.Width, height: image.Height);
    }

    /// <inheritdoc />
    public void DeleteAsset(LoginImageAsset asset)
    {
        ArgumentNullException.ThrowIfNull(asset);

        DeleteFilesStartingWith(assetManager.FileSystem, AssetsPrefix, $"{asset.Id}.");
        DeleteFilesStartingWith(assetManager.FileSystem, ThumbnailsPrefix, $"{asset.Id}-");

        // Only the current version's name is known; earlier versions were removed when this
        // one was published.
        var publishedFileName = CreateRuntimeImageFileName(asset);
        if (publishManager.FileSystem.FileExists(publishedFileName))
        {
            publishManager.FileSystem.DeleteFile(publishedFileName);
        }
    }

    /// <summary>
    /// Deletes the files in <paramref name="directory"/> whose name starts with
    /// <paramref name="fileNamePrefix"/>. Matches names here instead of passing a glob to
    /// <see cref="Umbraco.Cms.Core.IO.IFileSystem.GetFiles(string, string)"/>, because the Azure
    /// Blob provider treats that filter as a literal substring and a glob such as <c>id.*</c>
    /// matches nothing.
    /// </summary>
    private static void DeleteFilesStartingWith(
        Umbraco.Cms.Core.IO.IFileSystem fileSystem,
        string directory,
        string fileNamePrefix)
    {
        var matches = fileSystem.GetFiles(directory.TrimEnd('/'))
            .Where(path => Path.GetFileName(path).StartsWith(fileNamePrefix, StringComparison.OrdinalIgnoreCase))
            .ToList();

        foreach (var path in matches)
        {
            fileSystem.DeleteFile(path);
        }
    }

    /// <inheritdoc />
    /// <remarks>Stale publications are pruned only after a new file is written; failures are logged and rethrown.</remarks>
    public async Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(
        LoginImageAsset imageAsset,
        IReadOnlyCollection<LoginImageAsset> assetsToKeepPublished)
    {
        ArgumentNullException.ThrowIfNull(imageAsset);
        ArgumentNullException.ThrowIfNull(assetsToKeepPublished);

        var imageFileName = CreateRuntimeImageFileName(imageAsset);

        try
        {
            // Clean up only after writing a new file. An image that is already published
            // costs no listing and no deletes, so a public request cannot remove a file
            // another visitor was just redirected to.
            if (await PublishImageIfMissingAsync(imageAsset.StoragePath, imageFileName))
            {
                PruneStalePublications(imageFileName, assetsToKeepPublished);
            }

            return new PublishedRuntimeAssetPaths(publishManager.GetPublicUrl(imageFileName));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create runtime publication for asset {AssetId}", imageAsset.Id);
            throw;
        }
    }

    /// <inheritdoc />
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

    private void PruneStalePublications(
        string publishedImageFileName,
        IReadOnlyCollection<LoginImageAsset> assetsToKeepPublished)
    {
        try
        {
            var keepFileNames = assetsToKeepPublished
                .Select(CreateRuntimeImageFileName)
                .Append(publishedImageFileName)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            foreach (var existing in publishManager.FileSystem.GetFiles(""))
            {
                if (IsPublicationFileName(existing) && !keepFileNames.Contains(existing))
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
        using var image = await LoadBoundedImageAsync(sourceStream, () => assetManager.FileSystem.OpenFile(sourcePath));
        image.Mutate(op => op.AutoOrient().Resize(new ResizeOptions
        {
            Mode = ResizeMode.Max,
            Size = new Size(ThumbnailMaxDimension, ThumbnailMaxDimension)
        }));
        StripMetadata(image);
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

    /// <returns><c>true</c> when the image was written; <c>false</c> when it was already published.</returns>
    private async Task<bool> PublishImageIfMissingAsync(string storagePath, string publishFileName)
    {
        if (publishManager.FileSystem.FileExists(publishFileName))
        {
            return false;
        }

        using var sourceStream = assetManager.FileSystem.OpenFile(storagePath);
        using var image = await LoadBoundedImageAsync(sourceStream, () => assetManager.FileSystem.OpenFile(storagePath));
        image.Mutate(op => op.AutoOrient());
        StripMetadata(image);
        using var encoded = new MemoryStream();
        await image.SaveAsJpegAsync(encoded);
        encoded.Position = 0;
        publishManager.FileSystem.AddFile(publishFileName, encoded);
        return true;
    }

    private static async Task<Image> LoadBoundedImageAsync(Stream stream, Func<Stream>? reopenStream = null)
    {
        ImageInfo info;
        try
        {
            info = await Image.IdentifyAsync(stream);
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException)
        {
            throw new InvalidDataException("The uploaded file is not a valid image.", ex);
        }

        var frameCount = Math.Max(1, info.FrameMetadataCollection.Count);
        var pixelCount = (long)info.Width * info.Height * frameCount;
        if (pixelCount <= 0 || pixelCount > MaxImagePixels)
        {
            throw new InvalidDataException(
                $"Image dimensions {info.Width}x{info.Height} ({frameCount} frame(s)) exceed the maximum allowed pixel count of {MaxImagePixels}.");
        }

        Stream decodeStream = stream;
        Stream? reopened = null;
        try
        {
            if (stream.CanSeek)
            {
                stream.Position = 0;
            }
            else if (reopenStream is not null)
            {
                reopened = reopenStream();
                decodeStream = reopened;
            }
            else
            {
                throw new InvalidDataException("Unable to rewind image stream for decoding.");
            }

            return await Image.LoadAsync(decodeStream);
        }
        catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException)
        {
            throw new InvalidDataException("The uploaded file is not a valid image.", ex);
        }
        finally
        {
            if (reopened is not null)
            {
                await reopened.DisposeAsync();
            }
        }
    }

    private static void StripMetadata(Image image)
    {
        image.Metadata.ExifProfile = null;
        image.Metadata.XmpProfile = null;
        image.Metadata.IptcProfile = null;

        foreach (var frame in image.Frames)
        {
            frame.Metadata.ExifProfile = null;
            frame.Metadata.XmpProfile = null;
            frame.Metadata.IptcProfile = null;
        }
    }

    private static bool IsPublicationFileName(string path)
    {
        if (path.Contains('/', StringComparison.Ordinal) || path.Contains('\\', StringComparison.Ordinal))
        {
            return false;
        }

        if (path.Length != 36 || !path.EndsWith(".jpg", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        for (var i = 0; i < 32; i++)
        {
            if (!Uri.IsHexDigit(path[i]))
            {
                return false;
            }
        }

        return true;
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

    private static readonly XNamespace SvgNamespace = "http://www.w3.org/2000/svg";

    /// <summary>
    /// SVG elements a logo may contain: shapes, text, paint servers, clipping, filters and
    /// embedded images. Anything else — <c>script</c>, <c>foreignObject</c>, <c>a</c>, the
    /// animation elements and elements from other namespaces — is removed with its content.
    /// </summary>
    private static readonly HashSet<string> AllowedSvgElements = new(StringComparer.Ordinal)
    {
        "svg", "g", "defs", "symbol", "use", "switch", "title", "desc", "style",
        "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
        "text", "tspan", "textPath",
        "linearGradient", "radialGradient", "stop", "pattern", "clipPath", "mask", "marker", "image",
        "filter", "feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix",
        "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood",
        "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge",
        "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting",
        "feSpotLight", "feTile", "feTurbulence",
    };

    /// <summary>Embedded raster images an <c>href</c> may carry. SVG data URLs are excluded.</summary>
    private static readonly string[] AllowedDataImagePrefixes =
    [
        "data:image/png", "data:image/jpeg", "data:image/jpg", "data:image/gif", "data:image/webp",
    ];

    /// <summary>
    /// Reduces an uploaded SVG to drawing content only, using an allowlist of elements and
    /// link targets. The DTD is ignored and dropped, so exported files with a DOCTYPE still load
    /// but no entity is expanded.
    /// </summary>
    /// <exception cref="InvalidDataException">The upload is not well-formed SVG.</exception>
    private static MemoryStream SanitiseSvg(Stream input)
    {
        XDocument document;
        try
        {
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Ignore, XmlResolver = null };
            using var reader = XmlReader.Create(input, settings);
            document = XDocument.Load(reader);
        }
        catch (XmlException ex)
        {
            throw new InvalidDataException("The SVG file is not well-formed XML.", ex);
        }

        if (document.Root is null || !IsAllowedElement(document.Root) || document.Root.Name.LocalName != "svg")
        {
            throw new InvalidDataException("The file is not an SVG image.");
        }

        document.DocumentType?.Remove();
        foreach (var node in document.Nodes().OfType<XProcessingInstruction>().ToList())
        {
            node.Remove();
        }

        foreach (var element in document.Root.Descendants().Where(element => !IsAllowedElement(element)).ToList())
        {
            // An ancestor may already have been removed, taking this element with it.
            if (element.Parent is not null)
            {
                element.Remove();
            }
        }

        foreach (var element in document.Root.DescendantsAndSelf())
        {
            foreach (var attribute in element.Attributes().Where(IsUnsafeAttribute).ToList())
            {
                attribute.Remove();
            }
        }

        var output = new MemoryStream();
        document.Save(output, SaveOptions.None);
        output.Position = 0;
        return output;
    }

    private static bool IsAllowedElement(XElement element) =>
        (element.Name.Namespace == SvgNamespace || element.Name.Namespace == XNamespace.None)
        && AllowedSvgElements.Contains(element.Name.LocalName);

    private static bool IsUnsafeAttribute(XAttribute attribute)
    {
        if (attribute.IsNamespaceDeclaration)
        {
            return false;
        }

        var name = attribute.Name.LocalName;
        if (name.StartsWith("on", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        // Covers both `href` and `xlink:href`.
        return name.Equals("href", StringComparison.OrdinalIgnoreCase) && !IsSafeLinkTarget(attribute.Value);
    }

    /// <summary>
    /// A link may point inside the document (<c>#id</c>) or embed a raster image. Whitespace
    /// and control characters are removed first, because browsers ignore them inside a URL
    /// scheme (<c>java&amp;#9;script:</c>).
    /// </summary>
    private static bool IsSafeLinkTarget(string value)
    {
        var compact = new string(value.Where(character => !char.IsWhiteSpace(character) && !char.IsControl(character)).ToArray());
        return compact.StartsWith('#')
            || AllowedDataImagePrefixes.Any(prefix => compact.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
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
