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
    /// <summary>Rule id (primary key), up to 64 characters.</summary>
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    [Length(64)]
    public string Id { get; set; } = string.Empty;

    /// <summary>Rule display name, up to 255 characters.</summary>
    [Column("Name")]
    [Length(255)]
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether the rule takes part in resolution.</summary>
    [Column("Enabled")]
    public bool Enabled { get; set; } = true;

    /// <summary>Evaluation order; lower values are evaluated first.</summary>
    [Column("Priority")]
    public int Priority { get; set; }

    /// <summary>JsonLogic condition, as unbounded JSON text.</summary>
    [Column("Condition")]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string Condition { get; set; } = string.Empty;

    /// <summary>JSON array of image ids. See <see cref="RuleAssetIdsSerialiser"/>.</summary>
    [Column("AssetIds")]
    [SpecialDbType(SpecialDbTypes.NVARCHARMAX)]
    public string AssetIds { get; set; } = string.Empty;
}
