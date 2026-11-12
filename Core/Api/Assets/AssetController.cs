using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Security;

namespace LeLøgin.Core.Api.Assets;

/// <summary>
/// Management endpoints for login screen image assets: list, get, preview, thumbnail, upload,
/// update and delete. Source files are read from the package-owned asset file system only.
/// </summary>
/// <param name="store">Reads and writes assets and rules.</param>
/// <param name="fileService">Saves uploads, encodes thumbnails and deletes asset files.</param>
/// <param name="fileStreamSecurityValidator">Umbraco's validator that rejects unsafe upload content.</param>
/// <param name="contentSettings">The site's upload policy (allowed and disallowed extensions).</param>
/// <param name="assetManager">Gives access to the asset file system.</param>
/// <param name="logger">Logs thumbnail failures.</param>
public class AssetController(
	ILeLøginScreenStore store,
	ILeLøginScreenFileService fileService,
	IFileStreamSecurityValidator fileStreamSecurityValidator,
	IOptionsMonitor<ContentSettings> contentSettings,
	LeLøginAssetFileManager assetManager,
	ILogger<AssetController> logger) : ApiControllerBase
{
	private const long MaxUploadSizeBytes = 10 * 1024 * 1024;
	private const long MaxUploadRequestSizeBytes = MaxUploadSizeBytes + 64 * 1024; // Multipart fields and headers.

	/// <summary>Lists every asset of both kinds.</summary>
	/// <returns>200 with the assets.</returns>
	[HttpGet("assets")]
	[ProducesResponseType<IEnumerable<LoginImageAsset>>(StatusCodes.Status200OK)]
	public async Task<IActionResult> GetAll()
	{
		var assets = await store.GetAllAssetsAsync();
		return Ok(assets);
	}

	/// <summary>Gets a single asset's metadata.</summary>
	/// <param name="id">Id of the asset.</param>
	/// <returns>200 with the asset; 404 when it does not exist.</returns>
	[HttpGet("assets/{id}")]
	[ProducesResponseType<LoginImageAsset>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Get(string id)
	{
		var asset = await store.GetAssetAsync(id);
		return asset is null ? NotFound() : Ok(asset);
	}

	/// <summary>Streams the asset's full-size source file, with a content type inferred from its extension.</summary>
	/// <param name="id">Id of the asset.</param>
	/// <returns>200 with the file; 404 when the asset or its file does not exist or cannot be read.</returns>
	[HttpGet("assets/{id}/preview")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Preview(string id)
	{
		var asset = await store.GetAssetAsync(id);
		if (asset is null)
		{
			return NotFound();
		}

		try
		{
			if (!assetManager.FileSystem.FileExists(asset.StoragePath))
			{
				return NotFound();
			}

			var contentTypeProvider = new FileExtensionContentTypeProvider();
			var contentType = contentTypeProvider.TryGetContentType(asset.StoragePath, out var resolvedContentType)
				? resolvedContentType
				: "application/octet-stream";

			ImageResponseHeaders.Apply(Response);
			var stream = assetManager.FileSystem.OpenFile(asset.StoragePath);
			return File(stream, contentType);
		}
		catch (UnauthorizedAccessException)
		{
			return NotFound();
		}
	}

	/// <summary>
	/// Returns a downscaled WebP of the asset, or the sanitised source for SVG assets, for the
	/// backoffice cards and editor previews. Encodes and caches the thumbnail on first request.
	/// </summary>
	/// <param name="id">Id of the asset.</param>
	/// <returns>
	/// 200 with the thumbnail; 304 when unchanged since <c>If-Modified-Since</c>; 404 when the
	/// asset does not exist or the thumbnail cannot be produced (the failure is logged).
	/// </returns>
	[HttpGet("assets/{id}/thumbnail")]
	[ProducesResponseType(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status304NotModified)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Thumbnail(string id)
	{
		var asset = await store.GetAssetAsync(id);
		if (asset is null)
		{
			return NotFound();
		}

		EncodedThumbnail thumbnail;
		try
		{
			thumbnail = await fileService.GetThumbnailAsync(asset);
		}
		catch (UnauthorizedAccessException)
		{
			return NotFound();
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Failed to encode thumbnail for asset {AssetId}", id);
			return NotFound();
		}

		try
		{
			ImageResponseHeaders.Apply(Response);
			var stream = assetManager.FileSystem.OpenFile(thumbnail.FileName);
			// Passing the modification time lets MVC answer If-Modified-Since with 304.
			return new FileStreamResult(stream, thumbnail.ContentType)
			{
				LastModified = new DateTimeOffset(thumbnail.LastModifiedUtc, TimeSpan.Zero),
			};
		}
		catch (UnauthorizedAccessException)
		{
			return NotFound();
		}
	}

	/// <summary>
	/// Uploads a new asset. The file must be at most 10 MB, allowed by the site's upload policy, a
	/// supported image format (SVG for logos only) and pass Umbraco's file-stream security check.
	/// </summary>
	/// <param name="request">The file, name, kind and optional alternative text.</param>
	/// <returns>201 with the created asset; 400 when the upload is rejected.</returns>
	[HttpPost("assets")]
	[RequestSizeLimit(MaxUploadRequestSizeBytes)]
	[RequestFormLimits(MultipartBodyLengthLimit = MaxUploadSizeBytes)]
	[Consumes("multipart/form-data")]
	[ProducesResponseType<LoginImageAsset>(StatusCodes.Status201Created)]
	[ProducesResponseType(StatusCodes.Status400BadRequest)]
	public async Task<IActionResult> Upload([FromForm] UploadAssetRequest request)
	{
		if (!ModelState.IsValid)
		{
			return ValidationProblem(ModelState);
		}

		var file = request.File;
		if (file.Length == 0)
		{
			return BadRequest("No file provided.");
		}

		if (file.Length > MaxUploadSizeBytes)
		{
			return BadRequest($"File size exceeds maximum allowed size of {MaxUploadSizeBytes / (1024 * 1024)} MB.");
		}

		var extension = Path.GetExtension(file.FileName).TrimStart('.');
		if (!contentSettings.CurrentValue.IsFileAllowedForUpload(extension))
		{
			return BadRequest($"The file extension '{extension}' is not permitted by the site's upload policy.");
		}

		ReadOnlySpan<string> imageExtensions = ["jpg", "jpeg", "webp", "png", "gif", "svg", "bmp"];
		if (!imageExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
		{
			return BadRequest($"The file extension '{extension}' is not a supported image format.");
		}

		if (request.Kind == LoginImageAssetKind.Background && extension.Equals("svg", StringComparison.OrdinalIgnoreCase))
		{
			return BadRequest("SVG files are only supported for logo assets.");
		}

		using var validationBuffer = new MemoryStream();
		await file.CopyToAsync(validationBuffer);
		validationBuffer.Position = 0;
		if (!fileStreamSecurityValidator.IsConsideredSafe(validationBuffer))
		{
			return BadRequest("The uploaded file was rejected as potentially unsafe.");
		}

		var id = Guid.NewGuid().ToString("N");
		string storagePath;
		int width;
		int height;
		try
		{
			(storagePath, width, height) = await fileService.SaveUploadAsync(id, file);
		}
		catch (InvalidDataException ex)
		{
			return BadRequest(ex.Message);
		}

		var asset = new LoginImageAsset
		{
			Id = id,
			Name = request.Name,
			Kind = request.Kind,
			AltText = NormaliseOptionalText(request.AltText),
			GreetingText = null,
			LogoAssetId = null,
			StoragePath = storagePath,
			Width = width,
			Height = height,
		};

		await store.UpsertAssetAsync(asset);
		return CreatedAtAction(nameof(Get), new { id = asset.Id }, asset);
	}

	/// <summary>
	/// Updates an asset's metadata. A null name keeps the current one; every other field is replaced.
	/// Greeting, logo, focal point and zoom apply to backgrounds only and are cleared on logos.
	/// Focal point is clamped to 0–1 and zoom to 1–10.
	/// </summary>
	/// <param name="id">Id of the asset.</param>
	/// <param name="request">The asset's new values.</param>
	/// <returns>200 with the updated asset; 400 when the logo id is not an existing logo; 404 when the asset does not exist.</returns>
	[HttpPut("assets/{id}")]
	[ProducesResponseType<LoginImageAsset>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Update(string id, [FromBody] AssetUpdateRequest request)
	{
		var asset = await store.GetAssetAsync(id);
		if (asset is null)
		{
			return NotFound();
		}

		asset.Name = request.Name ?? asset.Name;
		asset.AltText = NormaliseOptionalText(request.AltText);
		asset.GreetingText = asset.Kind == LoginImageAssetKind.Background
			? NormaliseOptionalText(request.GreetingText)
			: null;
		asset.LogoAssetId = asset.Kind == LoginImageAssetKind.Background
			? NormaliseOptionalText(request.LogoAssetId)
			: null;
		asset.FocalPoint = asset.Kind == LoginImageAssetKind.Background
			? NormaliseFocalPoint(request.FocalPoint)
			: null;
		asset.Zoom = asset.Kind == LoginImageAssetKind.Background
			? NormaliseZoom(request.Zoom)
			: 1.0;
		asset.UpdatedAt = DateTime.UtcNow;

		if (asset.LogoAssetId is not null)
		{
			var logoCandidate = await store.GetAssetAsync(asset.LogoAssetId);
			if (logoCandidate is null || logoCandidate.Kind != LoginImageAssetKind.Logo)
			{
				return BadRequest("The selected logo asset could not be found.");
			}
		}

		await store.UpsertAssetAsync(asset);
		return Ok(asset);
	}

	/// <summary>
	/// Deletes an asset and its files. A deleted logo is unlinked from every background using it;
	/// the asset is removed from every rule, and a rule left without images is disabled.
	/// </summary>
	/// <param name="id">Id of the asset.</param>
	/// <returns>204 when deleted; 404 when the asset does not exist.</returns>
	[HttpDelete("assets/{id}")]
	[ProducesResponseType(StatusCodes.Status204NoContent)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Delete(string id)
	{
		var assets = await store.GetAllAssetsAsync();
		var asset = assets.FirstOrDefault(a => a.Id == id);
		if (asset is null)
		{
			return NotFound();
		}

		if (asset.Kind == LoginImageAssetKind.Logo)
		{
			var assetsUsingLogo = assets.Where(candidate => candidate.LogoAssetId == id).ToList();
			var now = DateTime.UtcNow;

			foreach (var assetUsingLogo in assetsUsingLogo)
			{
				assetUsingLogo.LogoAssetId = null;
				assetUsingLogo.UpdatedAt = now;
				await store.UpsertAssetAsync(assetUsingLogo);
			}
		}

		await RemoveFromRulesAsync(id);

		fileService.DeleteAsset(asset);
		await store.DeleteAssetAsync(id);
		return NoContent();
	}

	/// <summary>
	/// Removes a deleted asset from every rule that shows it. A rule left without images is
	/// disabled rather than deleted, so its name, condition and priority survive until an
	/// editor gives it a new image.
	/// </summary>
	private async Task RemoveFromRulesAsync(string assetId)
	{
		var rules = await store.GetAllRulesAsync();
		foreach (var rule in rules)
		{
			var remainingAssetIds = rule.AssetIds
				.Where(candidate => !string.Equals(candidate, assetId, StringComparison.OrdinalIgnoreCase))
				.ToList();
			if (remainingAssetIds.Count == rule.AssetIds.Count)
			{
				continue;
			}

			rule.AssetIds = remainingAssetIds;
			if (remainingAssetIds.Count == 0)
			{
				rule.Enabled = false;
			}

			await store.UpsertRuleAsync(rule);
		}
	}

	/// <summary>
	/// Retired endpoint: publishing a single asset is no longer supported; a catch-all rule replaces it.
	/// </summary>
	/// <param name="id">Id of the asset.</param>
	/// <returns>400 for an existing asset; 404 when the asset does not exist.</returns>
	[HttpPost("assets/{id}/publish")]
	[ProducesResponseType(StatusCodes.Status400BadRequest)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Publish(string id)
	{
		var asset = await store.GetAssetAsync(id);
		if (asset is null)
		{
			return NotFound();
		}

		return BadRequest("Publishing a single asset is no longer supported. Create a catch-all rule instead.");
	}

	private static string? NormaliseOptionalText(string? value)
	{
		return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
	}

	private static FocalPoint? NormaliseFocalPoint(FocalPoint? value)
	{
		if (value is null)
			return null;
		return new FocalPoint
		{
			Left = Math.Clamp(value.Left, 0d, 1d),
			Top = Math.Clamp(value.Top, 0d, 1d),
		};
	}

	private static double NormaliseZoom(double? value)
	{
		var raw = value ?? 1.0;
		// Math.Clamp lets NaN through unchanged — guard explicitly so a malformed
		// payload (`{"zoom": "NaN"}`) cannot be persisted as a non-finite double.
		if (!double.IsFinite(raw)) return 1.0;
		var clamped = Math.Clamp(raw, 1.0, 10.0);
		// Snap near-1 values to exactly 1.0 so floating-point drift around the
		// scroll-to-min boundary doesn't produce spurious `cc=…` runtime URLs.
		return clamped < 1.001 ? 1.0 : clamped;
	}

}

/// <summary>
/// Request body for updating an asset's metadata. Blank text values are stored as <see langword="null"/>.
/// </summary>
/// <param name="Name">New display name, or <see langword="null"/> to keep the current one.</param>
/// <param name="AltText">Alternative text for the image.</param>
/// <param name="GreetingText">Greeting shown with a background; ignored for logos.</param>
/// <param name="LogoAssetId">Id of the logo to pair with a background; ignored for logos.</param>
/// <param name="FocalPoint">Focal point of a background, clamped to 0–1; ignored for logos.</param>
/// <param name="Zoom">Zoom factor of a background, clamped to 1–10; <see langword="null"/> or non-finite means 1.</param>
public sealed record AssetUpdateRequest(
	[MaxLength(200)] string? Name,
	[MaxLength(500)] string? AltText,
	[MaxLength(500)] string? GreetingText,
	[MaxLength(50)] string? LogoAssetId,
	FocalPoint? FocalPoint,
	double? Zoom);

/// <summary>
/// Multipart form for uploading a new asset.
/// </summary>
public sealed class UploadAssetRequest
{
	/// <summary>The image file (form field <c>file</c>).</summary>
	[Required]
	[FromForm(Name = "file")]
	public required IFormFile File { get; init; }

	/// <summary>Display name of the asset (form field <c>name</c>).</summary>
	[Required]
	[MaxLength(200)]
	[FromForm(Name = "name")]
	public required string Name { get; init; }

	/// <summary>Whether the asset is a background or a logo (form field <c>kind</c>).</summary>
	[Required]
	[FromForm(Name = "kind")]
	public required LoginImageAssetKind Kind { get; init; }

	/// <summary>Optional alternative text (form field <c>altText</c>).</summary>
	[MaxLength(500)]
	[FromForm(Name = "altText")]
	public string? AltText { get; init; }
}
