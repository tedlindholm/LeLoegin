using LeLøgin.Core.Storage;
using LeLøgin.Tests.Site;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LeLøgin.Tests.Storage.Migrations;

/// <summary>
/// Upgrades a database that still has the single-image <c>LeLoginRules.AssetId</c> column and checks
/// that the migration keeps each rule's image, priority and enabled flag.
/// </summary>
public sealed class AddRuleAssetIdsTests
{
	[Fact]
	public async Task Upgrade_Moves_Each_Legacy_Rule_Image_Into_A_One_Element_List_And_Keeps_The_Rest()
	{
		var contentRootPath = Path.Combine(Path.GetTempPath(), "LeLøgin.Tests", Guid.NewGuid().ToString("N"));
		try
		{
			await InstallSiteAsync(contentRootPath);
			ReplaceRulesWithLegacyTable(contentRootPath);

			await using var upgraded = await LoginScreenStoreTests.StartInstalledSiteAsync(
				contentRootPath,
				deleteContentRootOnDispose: false);
			await using var scope = upgraded.Services.CreateAsyncScope();
			var store = scope.ServiceProvider.GetRequiredService<ILeLøginScreenStore>();

			var monday = await store.GetRuleAsync("rule-monday");
			Assert.NotNull(monday);
			Assert.Equal(["asset-monday"], monday.AssetIds);
			Assert.Equal(20, monday.Priority);
			Assert.True(monday.Enabled);
			Assert.Equal("Monday", monday.Name);

			var off = await store.GetRuleAsync("rule-off");
			Assert.NotNull(off);
			Assert.Equal(["asset-off"], off.AssetIds);
			Assert.Equal(30, off.Priority);
			Assert.False(off.Enabled);
		}
		finally
		{
			if (Directory.Exists(contentRootPath))
			{
				Directory.Delete(contentRootPath, recursive: true);
			}
		}
	}

	private static async Task InstallSiteAsync(string contentRootPath)
	{
		await using var installer = new FreshInstallSite(
			configureEmptySqlite: true,
			installUnattended: true,
			contentRootPath: contentRootPath,
			deleteContentRootOnDispose: false);
		using var client = installer.CreateClient();
		using var response = await client.GetAsync("/umbraco/");
		Assert.True(response.IsSuccessStatusCode, $"The installer did not boot: {(int)response.StatusCode}.");
	}

	/// <summary>
	/// Rebuilds <c>LeLoginRules</c> in its pre-migration shape and clears Umbraco's record that the
	/// LeLøgin plan has run, so the next start runs <c>AddRuleAssetIds</c> against these rows.
	/// </summary>
	private static void ReplaceRulesWithLegacyTable(string contentRootPath)
	{
		var databasePath = Path.Combine(contentRootPath, "umbraco", "Data", "Umbraco.sqlite.db");
		using var connection = new SqliteConnection($"Data Source={databasePath};Pooling=False");
		connection.Open();

		using (var clearState = connection.CreateCommand())
		{
			clearState.CommandText = "SELECT [key] FROM umbracoKeyValue";
			using var reader = clearState.ExecuteReader();
			var keys = new List<string>();
			while (reader.Read())
			{
				keys.Add(reader.GetString(0));
			}

			reader.Close();
			foreach (var key in keys.Where(key => key.Contains("LeLogin", StringComparison.Ordinal)))
			{
				using var delete = connection.CreateCommand();
				delete.CommandText = "DELETE FROM umbracoKeyValue WHERE [key] = $key";
				delete.Parameters.AddWithValue("$key", key);
				delete.ExecuteNonQuery();
			}
		}

		using var rebuild = connection.CreateCommand();
		rebuild.CommandText = """
			DROP TABLE LeLoginRules;
			CREATE TABLE LeLoginRules (
				Id TEXT NOT NULL PRIMARY KEY,
				Name TEXT NOT NULL,
				Enabled INTEGER NOT NULL,
				Priority INTEGER NOT NULL,
				Condition TEXT NOT NULL,
				AssetId TEXT NOT NULL
			);
			INSERT INTO LeLoginRules (Id, Name, Enabled, Priority, Condition, AssetId) VALUES
				('rule-monday', 'Monday', 1, 20, '{"and":[]}', 'asset-monday'),
				('rule-off', 'Off', 0, 30, '{"and":[]}', 'asset-off');
			""";
		rebuild.ExecuteNonQuery();
	}
}
