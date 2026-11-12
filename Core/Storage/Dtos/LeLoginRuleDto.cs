using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Dtos;

/// <summary>
/// NPoco DTO for runtime read/write of the <c>LeLoginRules</c> table. Mapped to and from
/// <see cref="LeLøgin.Core.Models.LoginRule"/> by <c>LeLøginScreenStore</c>.
/// </summary>
[TableName("LeLoginRules")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by NPoco via reflection.")]
internal sealed class LeLoginRuleDto
{
    /// <summary>Rule id (primary key).</summary>
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    public string Id { get; set; } = string.Empty;

    /// <summary>Rule display name.</summary>
    [Column("Name")]
    public string Name { get; set; } = string.Empty;

    /// <summary>Whether the rule takes part in resolution.</summary>
    [Column("Enabled")]
    public bool Enabled { get; set; } = true;

    /// <summary>Evaluation order; lower values are evaluated first, ties broken by id.</summary>
    [Column("Priority")]
    public int Priority { get; set; }

    /// <summary>JsonLogic condition, as JSON text.</summary>
    [Column("Condition")]
    public string Condition { get; set; } = string.Empty;

    /// <summary>JSON array of image ids. See <see cref="RuleAssetIdsSerialiser"/>.</summary>
    [Column("AssetIds")]
    public string AssetIds { get; set; } = string.Empty;
}
