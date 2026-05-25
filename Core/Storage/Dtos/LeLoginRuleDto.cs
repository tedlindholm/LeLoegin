using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Dtos;

[TableName("LeLoginRules")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by NPoco via reflection.")]
internal sealed class LeLoginRuleDto
{
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    public string Id { get; set; } = string.Empty;

    [Column("Name")]
    public string Name { get; set; } = string.Empty;

    [Column("Enabled")]
    public bool Enabled { get; set; } = true;

    [Column("Priority")]
    public int Priority { get; set; }

    [Column("Condition")]
    public string Condition { get; set; } = string.Empty;

    [Column("AssetId")]
    public string AssetId { get; set; } = string.Empty;
}
