namespace LeLøgin.Core.Models;

/// <summary>
/// A managed image asset available for use on the login screen.
/// </summary>
public sealed class LoginImageAsset
{
	/// <summary>Unique identifier of the asset.</summary>
	public required string Id { get; set; }

	/// <summary>Display name shown in the backoffice.</summary>
	public required string Name { get; set; }

	/// <summary>Whether the asset is a background image or a logo. Defaults to <see cref="LoginImageAssetKind.Background"/>.</summary>
	public LoginImageAssetKind Kind { get; set; } = LoginImageAssetKind.Background;

	/// <summary>Alternative text for the image, or <see langword="null"/> when none is set.</summary>
	public string? AltText { get; set; }

	/// <summary>Greeting shown on the login screen alongside this background, or <see langword="null"/> to keep Umbraco's default.</summary>
	public string? GreetingText { get; set; }

	/// <summary>Id of the logo asset paired with this background, or <see langword="null"/> to keep Umbraco's logo.</summary>
	public string? LogoAssetId { get; set; }

	/// <summary>Path of the source image in the package-owned asset file system.</summary>
	public required string StoragePath { get; set; }

	/// <summary>Path of the published copy in the public file system, or <see langword="null"/> when not published.</summary>
	public string? PublicPath { get; set; }

	/// <summary>Width of the source image in pixels.</summary>
	public int Width { get; set; }

	/// <summary>Height of the source image in pixels.</summary>
	public int Height { get; set; }

	/// <summary>Focal point used when cropping, or <see langword="null"/> for the centre.</summary>
	public FocalPoint? FocalPoint { get; set; }

	/// <summary>Zoom factor applied around the focal point; 1.0 means no zoom.</summary>
	public double Zoom { get; set; } = 1.0;

	/// <summary>UTC time the asset was created.</summary>
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

	/// <summary>UTC time the asset was last updated.</summary>
	public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
