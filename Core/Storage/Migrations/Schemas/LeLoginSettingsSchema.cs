using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Migrations.Schemas;

/// <summary>
/// Immutable schema snapshot for the <c>LeLoginSettings</c> singleton table.
/// One row only; <see cref="Id"/> is fixed to <c>1</c>.
/// </summary>
[TableName("LeLoginSettings")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Used as a generic-type argument by Create.Table<T>(); NPoco reads its attributes via reflection.")]
internal sealed class LeLoginSettingsSchema
{
    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    public int Id { get; set; }

    [Column("PublicEndpointCacheSeconds")]
    public int PublicEndpointCacheSeconds { get; set; } = 300;
}
