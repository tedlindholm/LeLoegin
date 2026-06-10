using System.Diagnostics.CodeAnalysis;
using LeLøgin.Core.Storage.Dtos;
using LeLøgin.Core.Storage.Migrations.Schemas;
using Microsoft.Extensions.Logging;
using NPoco;
using Umbraco.Cms.Infrastructure.Migrations;
using Umbraco.Cms.Infrastructure.Persistence.DatabaseAnnotations;

namespace LeLøgin.Core.Storage.Migrations;

/// <summary>
/// Migrates <c>LeLoginRules</c> from the single-image <c>AssetId</c> column to the multi-image
/// <c>AssetIds</c> JSON-array column. Existing rules keep their image — the old id is preserved as a
/// one-element array (see <see cref="RuleAssetIdsSerialiser.FromLegacyAssetId"/>).
///
/// The table is rebuilt rather than altered in place: SQLite cannot drop/alter columns, so the
/// cross-provider approach is to read the rows, recreate the table from the current schema, and
/// re-insert. <c>LeLoginRules</c> has no foreign keys, so this needs no special FK handling, and it
/// runs inside the migration transaction — an interruption rolls back with no data loss.
/// Idempotent: a no-op once the <c>AssetIds</c> column is present (fresh installs and re-runs).
/// </summary>
public sealed class AddRuleAssetIds : AsyncMigrationBase
{
	public AddRuleAssetIds(IMigrationContext context) : base(context)
	{
	}

	protected override async Task MigrateAsync()
	{
		Logger.LogDebug("Running migration {MigrationStep}", nameof(AddRuleAssetIds));

		if (ColumnExists("LeLoginRules", "AssetIds"))
		{
			Logger.LogDebug("Column {DbColumn} already exists on {DbTable}; skipping", "AssetIds", "LeLoginRules");
			return;
		}

		// Read the existing rows (legacy single AssetId) before touching the schema, converting each
		// rule's image id into the new one-element JSON array.
		var legacy = await Database.FetchAsync<LegacyRuleDto>().ConfigureAwait(false);
		var migrated = legacy
			.Select(row => new LeLoginRuleDto
			{
				Id = row.Id,
				Name = row.Name,
				Enabled = row.Enabled,
				Priority = row.Priority,
				Condition = row.Condition,
				AssetIds = RuleAssetIdsSerialiser.FromLegacyAssetId(row.AssetId),
			})
			.ToList();

		// Rebuild with the new schema, then restore the rows.
		Delete.Table("LeLoginRules").Do();
		Create.Table<LeLoginRuleSchema>().Do();

		foreach (var dto in migrated)
		{
			await Database.InsertAsync(dto).ConfigureAwait(false);
		}
	}

	/// <summary>Reads the pre-migration <c>LeLoginRules</c> shape, including the legacy <c>AssetId</c> column.</summary>
	[TableName("LeLoginRules")]
	[PrimaryKey("Id", AutoIncrement = false)]
	[ExplicitColumns]
	[SuppressMessage("Performance", "CA1812", Justification = "Instantiated by NPoco via reflection.")]
	private sealed class LegacyRuleDto
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
}
