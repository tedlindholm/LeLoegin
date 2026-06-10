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
		var context = new LoginRuntimeContext("monday", 5);
		var resolver = new LeLøginScreenRuntimeResolver(new StubRandom());

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
				Name = "May",
				AssetIds = ["asset-localhost"],
				Condition = "{\"and\":[{\"==\":[{\"var\":\"month\"},5]}]}"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-2",
				Name = "Monday",
				AssetIds = ["asset-monday"],
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			}
		};
		var context = new LoginRuntimeContext("monday", 5);
		var resolver = new LeLøginScreenRuntimeResolver(new StubRandom());

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
				AssetIds = ["asset-monday"],
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-2",
				Name = "Catch-all",
				AssetIds = ["asset-catch-all"],
				Condition = "{\"and\":[]}"
			}
		};
		var context = new LoginRuntimeContext("tuesday", 5);
		var resolver = new LeLøginScreenRuntimeResolver(new StubRandom());

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
				AssetIds = ["asset-monday"],
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			}
		};
		var context = new LoginRuntimeContext("tuesday", 5);
		var resolver = new LeLøginScreenRuntimeResolver(new StubRandom());

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
				AssetIds = ["asset-localhost"],
				Condition = "{"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-2",
				Name = "Monday",
				AssetIds = ["asset-monday"],
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}"
			}
		};
		var context = new LoginRuntimeContext("monday", 5);
		var resolver = new LeLøginScreenRuntimeResolver(new StubRandom());

		var resolved = resolver.ResolveAsset(assets, rules, context);

		Assert.Equal("asset-monday", resolved?.Id);
	}

	[Fact]
	public void ResolveAsset_Picks_The_Random_Indexed_Image_From_A_Matching_Rule()
	{
		var assets = new[]
		{
			CreateAsset("asset-a"),
			CreateAsset("asset-b"),
			CreateAsset("asset-c")
		};
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-random",
				Name = "Random",
				AssetIds = ["asset-a", "asset-b", "asset-c"],
				// Catch-all (no conditions) — a "random every login" rule.
				Condition = "{\"and\":[]}"
			}
		};
		var context = new LoginRuntimeContext("monday", 5);

		Assert.Equal("asset-a", Resolve(assets, rules, context, index: 0));
		Assert.Equal("asset-b", Resolve(assets, rules, context, index: 1));
		Assert.Equal("asset-c", Resolve(assets, rules, context, index: 2));
	}

	[Fact]
	public void ResolveAsset_Ignores_Random_Rule_Image_Ids_That_Do_Not_Exist()
	{
		// Only asset-b exists, so it is always chosen regardless of the random index.
		var assets = new[] { CreateAsset("asset-b") };
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-random",
				Name = "Random",
				AssetIds = ["missing-a", "asset-b", "missing-c"],
				Condition = "true"
			}
		};
		var context = new LoginRuntimeContext("monday", 5);

		Assert.Equal("asset-b", Resolve(assets, rules, context, index: 0));
		Assert.Equal("asset-b", Resolve(assets, rules, context, index: 2));
	}

	[Fact]
	public void ResolveAsset_Skips_A_Rule_Whose_Images_Are_All_Missing()
	{
		var assets = new[] { CreateAsset("asset-fallback") };
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-random",
				Name = "Random",
				AssetIds = ["missing-a", "missing-b"],
				Condition = "true"
			},
			new LoginRule
			{
				Priority = 20,
				Enabled = true,
				Id = "rule-fallback",
				Name = "Fallback",
				AssetIds = ["asset-fallback"],
				Condition = "{\"and\":[]}"
			}
		};
		var context = new LoginRuntimeContext("monday", 5);

		Assert.Equal("asset-fallback", Resolve(assets, rules, context, index: 0));
	}

	[Fact]
	public void ResolveAsset_Picks_A_Random_Image_Only_When_The_Rules_Condition_Matches()
	{
		// "Random image on Wednesdays": a weekday condition plus several images.
		var assets = new[]
		{
			CreateAsset("asset-a"),
			CreateAsset("asset-b"),
			CreateAsset("asset-c")
		};
		var rules = new[]
		{
			new LoginRule
			{
				Priority = 10,
				Enabled = true,
				Id = "rule-wednesday-random",
				Name = "Random on Wednesdays",
				AssetIds = ["asset-a", "asset-b", "asset-c"],
				Condition = "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"wednesday\"]}]}"
			}
		};

		// On Wednesday the rule matches and a random one of its images is shown.
		Assert.Equal("asset-b", Resolve(assets, rules, new LoginRuntimeContext("wednesday", 5), index: 1));
		Assert.Equal("asset-c", Resolve(assets, rules, new LoginRuntimeContext("wednesday", 5), index: 2));
		// On any other day the rule does not match, so nothing is shown.
		Assert.Null(Resolve(assets, rules, new LoginRuntimeContext("tuesday", 5), index: 0));
	}

	private static string? Resolve(
		IEnumerable<LoginImageAsset> assets,
		IEnumerable<LoginRule> rules,
		LoginRuntimeContext context,
		int index)
	{
		var resolver = new LeLøginScreenRuntimeResolver(new StubRandom(index));
		return resolver.ResolveAsset(assets, rules, context)?.Id;
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
