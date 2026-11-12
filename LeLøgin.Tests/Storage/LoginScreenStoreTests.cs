using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Site;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace LeLøgin.Tests.Storage;

/// <summary>
/// Runs the real NPoco store against the SQLite database that Umbraco installs for each test, so
/// these checks cover the mapping, the upsert and the delete path that the fake store skips.
/// </summary>
public sealed class LoginScreenStoreTests
{
	[Fact]
	public async Task Asset_Round_Trips_Every_Field_Through_The_Database()
	{
		await using var site = await StartInstalledSiteAsync();
		var asset = Asset("asset-full");
		asset.Kind = LoginImageAssetKind.Logo;
		asset.AltText = "Company logo";
		asset.GreetingText = "Welcome back";
		asset.LogoAssetId = "asset-logo";
		asset.FocalPoint = new FocalPoint { Left = 0.25, Top = 0.75 };
		asset.Zoom = 1.5;

		await WithStoreAsync(site, async store =>
		{
			await store.UpsertAssetAsync(asset);

			var stored = await store.GetAssetAsync("asset-full");

			Assert.NotNull(stored);
			Assert.Equal(asset.Name, stored.Name);
			Assert.Equal(LoginImageAssetKind.Logo, stored.Kind);
			Assert.Equal("Company logo", stored.AltText);
			Assert.Equal("Welcome back", stored.GreetingText);
			Assert.Equal("asset-logo", stored.LogoAssetId);
			Assert.Equal(asset.StoragePath, stored.StoragePath);
			Assert.Equal(asset.PublicPath, stored.PublicPath);
			Assert.Equal(1920, stored.Width);
			Assert.Equal(1080, stored.Height);
			Assert.NotNull(stored.FocalPoint);
			Assert.Equal(0.25, stored.FocalPoint.Left);
			Assert.Equal(0.75, stored.FocalPoint.Top);
			Assert.Equal(1.5, stored.Zoom);
			Assert.Equal(asset.CreatedAt, stored.CreatedAt);
			Assert.Equal(asset.UpdatedAt, stored.UpdatedAt);
		});
	}

	[Fact]
	public async Task Upserting_An_Existing_Asset_Updates_The_Row_Instead_Of_Adding_Another()
	{
		await using var site = await StartInstalledSiteAsync();

		await WithStoreAsync(site, async store =>
		{
			await store.UpsertAssetAsync(Asset("asset-one"));
			var renamed = Asset("asset-one");
			renamed.Name = "Renamed";
			await store.UpsertAssetAsync(renamed);

			var all = await store.GetAllAssetsAsync();

			var single = Assert.Single(all);
			Assert.Equal("Renamed", single.Name);
		});
	}

	[Fact]
	public async Task Rule_Round_Trips_Its_Ordered_Image_List_Condition_And_Enabled_Flag()
	{
		await using var site = await StartInstalledSiteAsync();

		await WithStoreAsync(site, async store =>
		{
			await store.UpsertRuleAsync(new LoginRule
			{
				Id = "rule-random",
				Name = "Random on Wednesdays",
				Enabled = false,
				Priority = 42,
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"wednesday\"]}]}",
				AssetIds = ["asset-b", "asset-a", "asset-c"]
			});

			var stored = await store.GetRuleAsync("rule-random");

			Assert.NotNull(stored);
			Assert.False(stored.Enabled);
			Assert.Equal(42, stored.Priority);
			Assert.Equal("{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"wednesday\"]}]}", stored.Condition);
			Assert.Equal(["asset-b", "asset-a", "asset-c"], stored.AssetIds);
		});
	}

	[Fact]
	public async Task DeleteAsset_Returns_False_For_An_Unknown_Id_And_True_When_It_Removes_The_Row()
	{
		await using var site = await StartInstalledSiteAsync();

		await WithStoreAsync(site, async store =>
		{
			await store.UpsertAssetAsync(Asset("asset-gone"));

			Assert.False(await store.DeleteAssetAsync("never-existed"));
			Assert.True(await store.DeleteAssetAsync("asset-gone"));
			Assert.Null(await store.GetAssetAsync("asset-gone"));
		});
	}

	[Fact]
	public async Task Asset_Ids_Match_Case_Insensitively_Because_The_Id_Column_Uses_NOCASE()
	{
		// Umbraco creates the LeLoginAssets columns COLLATE NOCASE, so these are one row. The fake store
		// matches ids the same way, so tests built on it see this behaviour too.
		await using var site = await StartInstalledSiteAsync();

		await WithStoreAsync(site, async store =>
		{
			await store.UpsertAssetAsync(Asset("Asset-A"));
			await store.UpsertAssetAsync(Asset("asset-a"));

			var single = Assert.Single(await store.GetAllAssetsAsync());
			Assert.Equal("asset-a", single.Id.ToLowerInvariant());
		});
	}

	private static LoginImageAsset Asset(string id) => new()
	{
		Id = id,
		Name = $"Name of {id}",
		StoragePath = $"assets/{id}.png",
		PublicPath = $"/login-screen/{id}.jpg",
		Width = 1920,
		Height = 1080,
		CreatedAt = new DateTime(2026, 5, 16, 9, 30, 0, DateTimeKind.Utc),
		UpdatedAt = new DateTime(2026, 5, 16, 9, 45, 0, DateTimeKind.Utc)
	};

	internal static async Task<FreshInstallSite> StartInstalledSiteAsync(
		string? contentRootPath = null,
		bool deleteContentRootOnDispose = true)
	{
		var site = new FreshInstallSite(
			configureEmptySqlite: true,
			installUnattended: contentRootPath is null,
			contentRootPath: contentRootPath,
			deleteContentRootOnDispose: deleteContentRootOnDispose);
		using var client = site.CreateClient();
		using var response = await client.GetAsync("/umbraco/");
		if (!response.IsSuccessStatusCode)
		{
			await site.DisposeAsync();
			throw new InvalidOperationException($"The installed site did not boot: {(int)response.StatusCode}.");
		}

		return site;
	}

	private static async Task WithStoreAsync(FreshInstallSite site, Func<ILeLøginScreenStore, Task> action)
	{
		await using var scope = site.Services.CreateAsyncScope();
		await action(scope.ServiceProvider.GetRequiredService<ILeLøginScreenStore>());
	}
}
