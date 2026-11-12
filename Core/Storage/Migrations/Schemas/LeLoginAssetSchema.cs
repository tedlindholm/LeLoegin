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
    /// <summary>Asset id (primary key), up to 64 characters.</summary>
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    [Length(64)]
    public string Id { get; set; } = string.Empty;

    /// <summary>Display name, up to 255 characters.</summary>
    [Column("Name")]
    [Length(255)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Asset kind: <c>background</c> or <c>logo</c>.</summary>
    [Column("Kind")]
    [Length(32)]
    public string Kind { get; set; } = "background";

    /// <summary>Alternative text; nullable, unbounded.</summary>
    [Column("AltText")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? AltText { get; set; }

    /// <summary>Login greeting for this background; nullable, unbounded.</summary>
    [Column("GreetingText")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string? GreetingText { get; set; }

    /// <summary>Id of the paired logo asset; nullable.</summary>
    [Column("LogoAssetId")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [Length(64)]
    public string? LogoAssetId { get; set; }

    /// <summary>Source file path relative to the private asset file system, up to 512 characters.</summary>
    [Column("StoragePath")]
    [Length(512)]
    public string StoragePath { get; set; } = string.Empty;

    /// <summary>Public path of the asset; nullable, up to 512 characters.</summary>
    [Column("PublicPath")]
    [NullSetting(NullSetting = NullSettings.Null)]
    [Length(512)]
    public string? PublicPath { get; set; }

    /// <summary>Source width in pixels.</summary>
    [Column("Width")]
    public int Width { get; set; }

    /// <summary>Source height in pixels.</summary>
    [Column("Height")]
    public int Height { get; set; }

    /// <summary>Focal point's horizontal position (0–1); nullable.</summary>
    [Column("FocalPointLeft")]
    [NullSetting(NullSetting = NullSettings.Null)]
    public double? FocalPointLeft { get; set; }

    /// <summary>Focal point's vertical position (0–1); nullable.</summary>
    [Column("FocalPointTop")]
    [NullSetting(NullSetting = NullSettings.Null)]
    public double? FocalPointTop { get; set; }

    /// <summary>Zoom factor; 1 means no crop.</summary>
    [Column("Zoom")]
    public double Zoom { get; set; } = 1.0;

    /// <summary>Creation time (UTC).</summary>
    [Column("CreatedAt")]
    public DateTime CreatedAt { get; set; }

    /// <summary>Last update time (UTC).</summary>
    [Column("UpdatedAt")]
    public DateTime UpdatedAt { get; set; }
}
