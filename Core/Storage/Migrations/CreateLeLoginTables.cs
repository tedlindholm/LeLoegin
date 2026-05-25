using LeLøgin.Core.Storage.Migrations.Schemas;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Infrastructure.Migrations;

namespace LeLøgin.Core.Storage.Migrations;

/// <summary>
/// Creates the <c>LeLoginAssets</c>, <c>LeLoginRules</c>, and <c>LeLoginSettings</c> tables
/// if they do not already exist. Idempotent — safe to re-run.
/// </summary>
public sealed class CreateLeLoginTables : AsyncMigrationBase
{
	public CreateLeLoginTables(IMigrationContext context) : base(context)
	{
	}

	protected override Task MigrateAsync()
	{
		Logger.LogDebug("Running migration {MigrationStep}", nameof(CreateLeLoginTables));

		if (TableExists("LeLoginAssets") == false)
		{
			Create.Table<LeLoginAssetSchema>().Do();
		}
		else
		{
			Logger.LogDebug("The database table {DbTable} already exists, skipping", "LeLoginAssets");
		}

		if (TableExists("LeLoginRules") == false)
		{
			Create.Table<LeLoginRuleSchema>().Do();
		}
		else
		{
			Logger.LogDebug("The database table {DbTable} already exists, skipping", "LeLoginRules");
		}

		if (TableExists("LeLoginSettings") == false)
		{
			Create.Table<LeLoginSettingsSchema>().Do();
		}
		else
		{
			Logger.LogDebug("The database table {DbTable} already exists, skipping", "LeLoginSettings");
		}

		return Task.CompletedTask;
	}
}
