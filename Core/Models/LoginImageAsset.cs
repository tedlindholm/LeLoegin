namespace LeLøgin.Core.Models;

/// <summary>
/// A managed image asset available for use on the login screen.
/// </summary>
public sealed class LoginImageAsset
{
	public required string Id { get; set; }
	public required string Name { get; set; }
	public LoginImageAssetKind Kind { get; set; } = LoginImageAssetKind.Background;
	public string? AltText { get; set; }
	public string? GreetingText { get; set; }
	public string? LogoAssetId { get; set; }
	public required string StoragePath { get; set; }
	public string? PublicPath { get; set; }
	public int Width { get; set; }
	public int Height { get; set; }
	public FocalPoint? FocalPoint { get; set; }
	public double Zoom { get; set; } = 1.0;
	public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
	public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
