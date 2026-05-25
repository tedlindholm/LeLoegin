using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Security;

namespace LeLøgin.Core.Api.Assets;

/// <summary>
/// Manages login screen image assets — list, get, upload, delete.
/// </summary>
public class AssetController(ILeLøginScreenStore store, ILeLøginScreenFileService fileService, IFileStreamSecurityValidator fileStreamSecurityValidator, IOptionsMonitor<ContentSettings> contentSettings, LeLøginAssetFileManager assetManager, LeLøginPackageManifestCacheInvalidator manifestCacheInvalidator) : ApiControllerBase
{
	private const long MaxUploadSizeBytes = 10 * 1024 * 1024; // 10 MB

	[HttpGet("assets")]
	[ProducesResponseType<IEnumerable<LoginImageAsset>>(StatusCodes.Status200OK)]
	public async Task<IActionResult> GetAll()
	{
		var assets = await store.GetAllAssetsAsync();
		return Ok(assets);
	}

	[HttpGet("assets/{id}")]
	[ProducesResponseType<LoginImageAsset>(StatusCodes.Status200OK)]
	[ProducesResponseType(StatusCodes.Status404NotFound)]
	public async Task<IActionResult> Get(string id)
	{
		var asset = await store.GetAssetAsync(id);
		return asset is null ? NotFound() : Ok(asset);
	}

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

			Response.Headers.XContentTypeOptions = "nosniff";
			var stream = assetManager.FileSystem.OpenFile(asset.StoragePath);
			return File(stream, contentType);
		}
		catch (UnauthorizedAccessException)
		{
			return NotFound();
		}
	}

	[HttpPost("assets")]
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
		var (storagePath, width, height) = await fileService.SaveUploadAsync(id, file);

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
		manifestCacheInvalidator.Invalidate();
		return CreatedAtAction(nameof(Get), new { id = asset.Id }, asset);
	}

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
		manifestCacheInvalidator.Invalidate();
		return Ok(asset);
	}

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

		fileService.DeleteAsset(id);
		await store.DeleteAssetAsync(id);
		manifestCacheInvalidator.Invalidate();
		return NoContent();
	}

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

public sealed record AssetUpdateRequest(
	[property: MaxLength(200)] string? Name,
	[property: MaxLength(500)] string? AltText,
	[property: MaxLength(500)] string? GreetingText,
	[property: MaxLength(50)] string? LogoAssetId,
	FocalPoint? FocalPoint,
	double? Zoom);

public sealed class UploadAssetRequest
{
	[Required]
	[FromForm(Name = "file")]
	public required IFormFile File { get; init; }

	[Required]
	[MaxLength(200)]
	[FromForm(Name = "name")]
	public required string Name { get; init; }

	[Required]
	[FromForm(Name = "kind")]
	public required LoginImageAssetKind Kind { get; init; }

	[MaxLength(500)]
	[FromForm(Name = "altText")]
	public string? AltText { get; init; }
}
