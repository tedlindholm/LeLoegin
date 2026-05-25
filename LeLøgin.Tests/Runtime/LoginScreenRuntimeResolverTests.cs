using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using Xunit;

namespace LeLøgin.Tests.Runtime;

public sealed class LeLøginScreenRuntimeResolverTests
{
	[Fact]
	public void ResolveAsset_Returns_Null_When_No_Enabled_Rules_Exist()
	{
		var assets = new[]
		{
			CreateAsset("asset-default"),
			CreateAsset("asset-monday")
		};
		var rules = Array.Empty<LoginRule>();
		var context = new LoginRuntimeContext("monday", 5, "2026-05-18", "localhost");
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(assets, rules, context);

		Assert.Null(resolved);
	}

	[Fact]
	public void ResolveAsset_Uses_First_Matching_Rule_When_Enabled_Rules_Exist()
	{
		var assets = new[]
		{
			CreateAsset("asset-default"),
			CreateAsset("asset-monday"),
			CreateAsset("asset-localhost")
		};
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-1",
				Name = "Localhost",
				AssetId = "asset-localhost",
				Condition = "{\"and\":[{\"==\":[{\"var\":\"hostname\"},\"localhost\"]}]}"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-2",
				Name = "Monday",
				AssetId = "asset-monday",
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			}
		};
		var context = new LoginRuntimeContext("monday", 5, "2026-05-18", "localhost");
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(assets, rules, context);

		Assert.Equal("asset-localhost", resolved?.Id);
	}

	[Fact]
	public void ResolveAsset_Uses_A_Catch_All_Rule_When_No_Conditional_Rule_Matches()
	{
		var assets = new[]
		{
			CreateAsset("asset-monday"),
			CreateAsset("asset-catch-all")
		};
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-1",
				Name = "Monday",
				AssetId = "asset-monday",
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-2",
				Name = "Catch-all",
				AssetId = "asset-catch-all",
				Condition = "{\"and\":[]}"
			}
		};
		var context = new LoginRuntimeContext("tuesday", 5, "2026-05-19", "localhost");
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(assets, rules, context);

		Assert.Equal("asset-catch-all", resolved?.Id);
	}

	[Fact]
	public void ResolveAsset_Returns_Null_When_Rules_Exist_But_Nothing_Matches_And_No_Catch_All_Rule_Exists()
	{
		var assets = new[]
		{
			CreateAsset("asset-monday")
		};
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-1",
				Name = "Monday",
				AssetId = "asset-monday",
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			}
		};
		var context = new LoginRuntimeContext("tuesday", 5, "2026-05-19", "localhost");
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(assets, rules, context);

		Assert.Null(resolved);
	}

	[Fact]
	public void ResolveAsset_Skips_Invalid_Rule_Condition_Json_And_Continues()
	{
		var assets = new[]
		{
			CreateAsset("asset-localhost"),
			CreateAsset("asset-monday")
		};
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-1",
				Name = "Broken",
				AssetId = "asset-localhost",
				Condition = "{"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-2",
				Name = "Monday",
				AssetId = "asset-monday",
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			}
		};
		var context = new LoginRuntimeContext("monday", 5, "2026-05-18", "localhost");
		var resolver = new LeLøginScreenRuntimeResolver();

		var resolved = resolver.ResolveAsset(assets, rules, context);

		Assert.Equal("asset-monday", resolved?.Id);
	}

	private static LoginImageAsset CreateAsset(string id) => new()
	{
		Id = id,
		Name = id,
		StoragePath = $"/tmp/{id}.jpg",
		Width = 1920,
		Height = 1080
	};
}
