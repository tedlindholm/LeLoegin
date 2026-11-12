using System.Diagnostics.CodeAnalysis;
using LeLøgin.Core.Models;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Dtos;

/// <summary>
/// NPoco DTO for runtime read/write of the <c>LeLoginAssets</c> table. Mapped to and from
/// <see cref="LoginImageAsset"/> by <c>LeLøginScreenStore</c>.
/// </summary>
[TableName("LeLoginAssets")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by NPoco via reflection.")]
internal sealed class LeLoginAssetDto
{
    /// <summary>Asset id (primary key); also the source file's base name.</summary>
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>Display name shown in the backoffice.</summary>
    [Column("Name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Asset kind as stored text: <c>background</c> or <c>logo</c>; anything else reads as background.</summary>
    [Column("Kind")]
    public string Kind { get; set; } = "background";

    /// <summary>Alternative text for the image, if set.</summary>
    [Column("AltText")]
    public string? AltText { get; set; }

    /// <summary>Greeting shown on the login screen with this background, if set.</summary>
    [Column("GreetingText")]
    public string? GreetingText { get; set; }

    /// <summary>Id of the logo asset paired with this background, if any.</summary>
    [Column("LogoAssetId")]
    public string? LogoAssetId { get; set; }

    /// <summary>Source file path, relative to the private asset file system.</summary>
    [Column("StoragePath")]
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>Public path of the asset, if one was recorded.</summary>
    [Column("PublicPath")]
    public string? PublicPath { get; set; }

    /// <summary>Source width in pixels; 0 when unknown.</summary>
    [Column("Width")]
    public int Width { get; set; }

    /// <summary>Source height in pixels; 0 when unknown.</summary>
    [Column("Height")]
    public int Height { get; set; }

    /// <summary>Focal point's horizontal position (0–1); the focal point is set only when both coordinates are.</summary>
    [Column("FocalPointLeft")]
    public double? FocalPointLeft { get; set; }

    /// <summary>Focal point's vertical position (0–1).</summary>
    [Column("FocalPointTop")]
    public double? FocalPointTop { get; set; }

    /// <summary>Zoom factor; 1 means no crop.</summary>
    [Column("Zoom")]
    public double Zoom { get; set; } = 1.0;

    /// <summary>Creation time, stored as UTC without a kind.</summary>
    [Column("CreatedAt")]
    public DateTime CreatedAt { get; set; }

    /// <summary>Last update time, stored as UTC without a kind; part of the published file name.</summary>
    [Column("UpdatedAt")]
    public DateTime UpdatedAt { get; set; }
}
