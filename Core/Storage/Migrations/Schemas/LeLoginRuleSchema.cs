using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Migrations.Schemas;

/// <summary>
/// Schema definition for the <c>LeLoginRules</c> table. Used by the create-tables migration for
/// fresh installs and by the <c>AddRuleAssetIds</c> rebuild migration when upgrading the
/// single-image <c>AssetId</c> column to the multi-image <c>AssetIds</c> JSON column.
/// </summary>
[TableName("LeLoginRules")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Used as a generic-type argument by Create.Table<T>(); NPoco reads its attributes via reflection.")]
internal sealed class LeLoginRuleSchema
{
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    [Length(64)]
    public string Id { get; set; } = string.Empty;

    [Column("Name")]
    [Length(255)]
    public string Name { get; set; } = string.Empty;

    [Column("Enabled")]
    public bool Enabled { get; set; } = true;

    [Column("Priority")]
    public int Priority { get; set; }

    [Column("Condition")]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string Condition { get; set; } = string.Empty;

    /// <summary>JSON array of image ids. See <see cref="LeLøgin.Core.Storage.RuleAssetIdsSerializer"/>.</summary>
    [Column("AssetIds")]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string AssetIds { get; set; } = string.Empty;
}
