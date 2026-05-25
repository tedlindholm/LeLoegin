using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Migrations.Schemas;

/// <summary>
/// Immutable schema snapshot for the <c>LeLoginAssets</c> table. Used only by the
/// initial Create-tables migration. Per Umbraco's database extension guidance,
/// schema snapshots must never be modified once a migration references them — any
/// future schema change creates a new snapshot class for a new migration step.
/// </summary>
[TableName("LeLoginAssets")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Used as a generic-type argument by Create.Table<T>(); NPoco reads its attributes via reflection.")]
internal sealed class LeLoginAssetSchema
{
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    [Length(64)]
    public string Id { get; set; } = string.Empty;

    [Column("Name")]
    [Length(255)]
    public string Name { get; set; } = string.Empty;

    [Column("Kind")]
    [Length(32)]
    public string Kind { get; set; } = "background";

    [Column("AltText")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? AltText { get; set; }

    [Column("GreetingText")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? GreetingText { get; set; }

    [Column("LogoAssetId")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [Length(64)]
    public string? LogoAssetId { get; set; }

    [Column("StoragePath")]
    [Length(512)]
    public string StoragePath { get; set; } = string.Empty;

    [Column("PublicPath")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [Length(512)]
    public string? PublicPath { get; set; }

    [Column("Width")]
    public int Width { get; set; }

    [Column("Height")]
    public int Height { get; set; }

    [Column("FocalPointLeft")]
    [NullSetting(NullSetting = NullSettings.Null)]
    public double? FocalPointLeft { get; set; }

    [Column("FocalPointTop")]
    [NullSetting(NullSetting = NullSettings.Null)]
    public double? FocalPointTop { get; set; }

    [Column("Zoom")]
    public double Zoom { get; set; } = 1.0;

    [Column("CreatedAt")]
    public DateTime CreatedAt { get; set; }

    [Column("UpdatedAt")]
    public DateTime UpdatedAt { get; set; }
}
