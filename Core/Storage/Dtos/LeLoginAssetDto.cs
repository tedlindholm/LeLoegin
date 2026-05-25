using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Dtos;

/// <summary>
/// NPoco DTO for runtime read/write of the <c>LeLoginAssets</c> table. Mapped to and from
/// <see cref="LeLøgin.Core.Models.LoginImageAsset"/> by <c>LeLøginScreenStore</c>.
/// </summary>
[TableName("LeLoginAssets")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by NPoco via reflection.")]
internal sealed class LeLoginAssetDto
{
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    public string Id { get; set; } = string.Empty;

    [Column("Name")]
    public string Name { get; set; } = string.Empty;

    [Column("Kind")]
    public string Kind { get; set; } = "background";

    [Column("AltText")]
    public string? AltText { get; set; }

    [Column("GreetingText")]
    public string? GreetingText { get; set; }

    [Column("LogoAssetId")]
    public string? LogoAssetId { get; set; }

    [Column("StoragePath")]
    public string StoragePath { get; set; } = string.Empty;

    [Column("PublicPath")]
    public string? PublicPath { get; set; }

    [Column("Width")]
    public int Width { get; set; }

    [Column("Height")]
    public int Height { get; set; }

    [Column("FocalPointLeft")]
    public double? FocalPointLeft { get; set; }

    [Column("FocalPointTop")]
    public double? FocalPointTop { get; set; }

    [Column("Zoom")]
    public double Zoom { get; set; } = 1.0;

    [Column("CreatedAt")]
    public DateTime CreatedAt { get; set; }

    [Column("UpdatedAt")]
    public DateTime UpdatedAt { get; set; }
}
