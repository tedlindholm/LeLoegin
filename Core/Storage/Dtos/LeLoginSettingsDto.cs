using System.Diagnostics.CodeAnalysis;
using NPoco;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Dtos;

[TableName("LeLoginSettings")]
[PrimaryKey("Id", AutoIncrement = false)]
[ExplicitColumns]
[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by NPoco via reflection.")]
internal sealed class LeLoginSettingsDto
{
    public const int SingletonId = 1;

    [PrimaryKeyColumn(AutoIncrement = false)]
    [Column("Id")]
    public int Id { get; set; } = SingletonId;

    [Column("PublicEndpointCacheSeconds")]
    public int PublicEndpointCacheSeconds { get; set; } = 300;
}
