using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Api.Runtime;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Web.Middleware;
using Xunit;

namespace LeLøgin.Tests.Api.Rules;

public sealed class RuleControllerTests : IDisposable
{
	private static readonly string[] WeekdayAssetIds = ["asset-a", "asset-b"];
	private readonly string _contentRootPath = Path.Combine(
		Path.GetTempPath(),
		"LeLøgin.Tests",
		Guid.NewGuid().ToString("N"));

	[Fact]
	public async Task GetAll_Maps_Legacy_Object_Backed_Stored_Conditions()
	{
		var store = CreateStore("""
		{
		  "assets": [],
		  "rules": [
		    {
		      "id": "rule-1",
		      "name": "Monday",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}",
		      "assetId": "asset-1"
		    }
		  ]
		}
		""");
		var controller = CreateController(store);

		var result = Assert.IsType<OkObjectResult>(await controller.GetAll());
		var rules = Assert.IsAssignableFrom<IEnumerable<LoginRuleResponseModel>>(result.Value).ToList();
		var rule = Assert.Single(rules);

		Assert.Equal("rule-1", rule.Id);
		Assert.Equal(LoginRuleConditionGroupOperator.All, rule.Condition.Operator);
		var condition = Assert.Single(rule.Condition.Conditions);
		Assert.Equal(LoginRuleField.Weekday, condition.Field);
		Assert.Equal(LoginRuleConditionOperator.Is, condition.Operator);
		Assert.Equal("monday", Assert.Single(condition.Values).Text);
	}

	[Fact]
	public async Task GetAll_Handles_Mixed_Legacy_Condition_Payloads_Without_Failing()
	{
		var store = CreateStore("""
		{
		  "assets": [],
		  "rules": [
		    {
		      "id": "rule-broken",
		      "name": "Broken",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"unsupported\":{\"nested\":true}}",
		      "assetId": "asset-broken"
		    },
		    {
		      "id": "rule-valid",
		      "name": "Valid",
		      "priority": 200,
		      "enabled": true,
		      "condition": "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}",
		      "assetId": "asset-valid"
		    }
		  ]
		}
		""");
		var controller = CreateController(store);

		var result = Assert.IsType<OkObjectResult>(await controller.GetAll());
		var rules = Assert.IsAssignableFrom<IEnumerable<LoginRuleResponseModel>>(result.Value).ToList();

		Assert.NotEmpty(rules);
		Assert.All(rules, rule =>
		{
			Assert.False(string.IsNullOrWhiteSpace(rule.Id));
			Assert.NotEmpty(rule.AssetIds);
		});
	}

	[Fact]
	public async Task GetAll_Maps_Stored_Empty_Condition_Groups_As_Catch_All_Rules()
	{
		var store = CreateStore("""
		{
		  "assets": [],
		  "rules": [
		    {
		      "id": "rule-catch-all",
		      "name": "Always",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"and\":[]}",
		      "assetId": "asset-catch-all"
		    }
		  ]
		}
		""");
		var controller = CreateController(store);

		var result = Assert.IsType<OkObjectResult>(await controller.GetAll());
		var rules = Assert.IsAssignableFrom<IEnumerable<LoginRuleResponseModel>>(result.Value).ToList();
		var rule = Assert.Single(rules);

		Assert.Equal("rule-catch-all", rule.Id);
		Assert.Equal(LoginRuleConditionGroupOperator.All, rule.Condition.Operator);
		Assert.Empty(rule.Condition.Conditions);
	}

	[Fact]
	public async Task Preview_Returns_NotFound_When_Rule_Does_Not_Exist()
	{
		var store = CreateStore("""
		{ "assets": [], "rules": [], "settings": { "publicEndpointCacheSeconds": 300 } }
		""");
		var controller = CreateController(store);

		var result = await controller.Preview("nonexistent-rule");
		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task Preview_Of_An_Image_No_Enabled_Rule_Uses_Keeps_The_Live_Login_Image_Published()
	{
		var store = CreateStore("""
		{
		  "assets": [
		    { "id": "asset-live", "name": "Live", "kind": "background", "storagePath": "assets/live.png", "width": 12, "height": 12, "updatedAt": "2026-05-15T00:00:00Z" },
		    { "id": "asset-draft", "name": "Draft", "kind": "background", "storagePath": "assets/draft.png", "width": 12, "height": 12, "updatedAt": "2026-05-16T00:00:00Z" }
		  ],
		  "rules": [
		    { "id": "rule-live", "name": "Live", "priority": 100, "enabled": true, "condition": "{\"and\":[]}", "assetId": "asset-live" },
		    { "id": "rule-draft", "name": "Draft", "priority": 200, "enabled": false, "condition": "{\"and\":[]}", "assetId": "asset-draft" }
		  ]
		}
		""");
		await CreateSourceImageAsync("live.png");
		await CreateSourceImageAsync("draft.png");
		var controller = CreateController(store);

		var live = await PreviewAsync(controller, "rule-live");
		var draft = await PreviewAsync(controller, "rule-draft");

		Assert.NotEqual(live.ImageUrl, draft.ImageUrl);
		Assert.True(File.Exists(ToPublicFilePath(live.ImageUrl)));
		Assert.True(File.Exists(ToPublicFilePath(draft.ImageUrl)));
	}

	[Fact]
	public async Task Preview_Returns_NoContent_When_Rules_Asset_Is_Missing()
	{
		// Rule references an asset id that doesn't exist — the preview can't render anything.
		var store = CreateStore("""
		{
		  "assets": [],
		  "rules": [
		    {
		      "id": "rule-orphan",
		      "name": "Orphan",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"and\":[]}",
		      "assetId": "missing-asset"
		    }
		  ],
		  "settings": { "publicEndpointCacheSeconds": 300 }
		}
		""");
		var controller = CreateController(store);

		var result = await controller.Preview("rule-orphan");
		Assert.IsType<NoContentResult>(result);
	}

	[Fact]
	public async Task Create_Persists_A_Rule_With_Multiple_Images_And_A_Condition()
	{
		// "Random image on Wednesdays": a normal weekday condition plus several images. The
		// resolver picks one image at random whenever the rule matches.
		var store = CreateStore("""
		{
		  "assets": [
		    { "id": "asset-a", "name": "A", "kind": "background", "storagePath": "/tmp/a.jpg", "width": 10, "height": 10 },
		    { "id": "asset-b", "name": "B", "kind": "background", "storagePath": "/tmp/b.jpg", "width": 10, "height": 10 }
		  ],
		  "rules": []
		}
		""");
		var controller = CreateController(store);
		var request = new SaveRuleRequest
		{
			Name = "Random on Wednesdays",
			Priority = 50,
			Enabled = true,
			Condition = new LoginRuleConditionGroupModel(
				LoginRuleConditionGroupOperator.All,
				[
					new LoginRuleConditionModel(
						"condition-1",
						LoginRuleField.Weekday,
						LoginRuleConditionOperator.Is,
						[LoginRuleConditionValue.FromText("wednesday")])
				]),
			AssetIds = ["asset-a", "asset-b"],
		};

		var created = Assert.IsType<CreatedAtActionResult>(await controller.Create(request));
		var model = Assert.IsType<LoginRuleResponseModel>(created.Value);

		Assert.Equal(LoginRuleConditionGroupOperator.All, model.Condition.Operator);
		Assert.Equal(LoginRuleField.Weekday, Assert.Single(model.Condition.Conditions).Field);
		Assert.Equal(WeekdayAssetIds, model.AssetIds);

		var stored = await store.GetRuleAsync(model.Id);
		Assert.NotNull(stored);
		Assert.Equal(WeekdayAssetIds, stored!.AssetIds);
	}

	[Fact]
	public async Task Create_Rejects_A_Rule_With_No_Images()
	{
		var store = CreateStore("""{ "assets": [], "rules": [] }""");
		var controller = CreateController(store);
		var request = new SaveRuleRequest
		{
			Name = "No images",
			Condition = new LoginRuleConditionGroupModel(LoginRuleConditionGroupOperator.All, []),
			AssetIds = [],
		};

		await controller.Create(request);

		Assert.False(controller.ModelState.IsValid);
		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.AssetIds)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	[Fact]
	public async Task Create_Rejects_A_Rule_Referencing_A_Missing_Image()
	{
		var store = CreateStore("""
		{
		  "assets": [
		    { "id": "asset-a", "name": "A", "kind": "background", "storagePath": "/tmp/a.jpg", "width": 10, "height": 10 }
		  ],
		  "rules": []
		}
		""");
		var controller = CreateController(store);
		var request = new SaveRuleRequest
		{
			Name = "Mixed",
			Condition = new LoginRuleConditionGroupModel(LoginRuleConditionGroupOperator.All, []),
			AssetIds = ["asset-a", "does-not-exist"],
		};

		await controller.Create(request);

		Assert.False(controller.ModelState.IsValid);
		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.AssetIds)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	[Fact]
	public async Task Create_Generates_The_Id_On_The_Server_And_Never_Overwrites_An_Existing_Rule()
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		await store.UpsertRuleAsync(CreateRule("rule-existing", "Existing", 100, ["asset-a"]));
		var controller = CreateController(store);

		var created = Assert.IsType<CreatedAtActionResult>(await controller.Create(SaveRequest("Intruder", ["asset-b"], id: "rule-existing")));

		var model = Assert.IsType<LoginRuleResponseModel>(created.Value);
		Assert.NotEqual("rule-existing", model.Id);
		Assert.Equal("Existing", (await store.GetRuleAsync("rule-existing"))!.Name);
		Assert.Equal(2, (await store.GetAllRulesAsync()).Count);
	}

	[Fact]
	public async Task Create_Rejects_A_Name_Longer_Than_The_Stored_Column()
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		var controller = CreateController(store);

		await controller.Create(SaveRequest(new string('x', 256), ["asset-a"]));

		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.Name)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	[Fact]
	public async Task Create_Rejects_A_Logo_As_A_Rule_Image()
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		var controller = CreateController(store);

		await controller.Create(SaveRequest("Logo rule", ["logo-a"]));

		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.AssetIds)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	[Fact]
	public async Task Create_Places_A_New_Rule_After_The_Last_One()
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		await store.UpsertRuleAsync(CreateRule("rule-first", "First", 100, ["asset-a"]));
		await store.UpsertRuleAsync(CreateRule("rule-last", "Last", 300, ["asset-b"]));
		var controller = CreateController(store);

		var created = Assert.IsType<CreatedAtActionResult>(await controller.Create(SaveRequest("New", ["asset-a"], priority: 100)));

		Assert.Equal(400, Assert.IsType<LoginRuleResponseModel>(created.Value).Priority);
	}

	[Fact]
	public void GetConditionMetadata_Only_Advertises_Supported_Operators()
	{
		var controller = CreateController(CreateStore(TwoBackgroundsAndOneLogo));

		var result = Assert.IsType<OkObjectResult>(controller.GetConditionMetadata());
		var metadata = Assert.IsType<ConditionMetadataResponse>(result.Value);

		Assert.Equal(["is", "isNot"], metadata.Operators.Keys.OrderBy(k => k, StringComparer.Ordinal).ToArray());
	}

	[Fact]
	public async Task Create_Rejects_Condition_With_Invalid_Weekday_Value()
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		var controller = CreateController(store);
		var request = new SaveRuleRequest
		{
			Name = "Bad weekday",
			Enabled = true,
			Priority = 0,
			Condition = new LoginRuleConditionGroupModel(
				LoginRuleConditionGroupOperator.All,
				[new LoginRuleConditionModel("c1", LoginRuleField.Weekday, LoginRuleConditionOperator.Is, [LoginRuleConditionValue.FromText("funday")])]),
			AssetIds = ["asset-a"]
		};

		await controller.Create(request);

		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.Condition)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	[Theory]
	[InlineData(0)]
	[InlineData(13)]
	public async Task Create_Rejects_Condition_With_Invalid_Month_Value(int month)
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		var controller = CreateController(store);
		var request = new SaveRuleRequest
		{
			Name = "Bad month",
			Enabled = true,
			Priority = 0,
			Condition = new LoginRuleConditionGroupModel(
				LoginRuleConditionGroupOperator.All,
				[new LoginRuleConditionModel("c1", LoginRuleField.Month, LoginRuleConditionOperator.Is, [LoginRuleConditionValue.FromNumber(month)])]),
			AssetIds = ["asset-a"]
		};

		await controller.Create(request);

		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.Condition)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	[Theory]
	[InlineData(LoginRuleConditionOperator.In)]
	[InlineData(LoginRuleConditionOperator.NotIn)]
	[InlineData(LoginRuleConditionOperator.Between)]
	[InlineData(LoginRuleConditionOperator.NotBetween)]
	public async Task Create_Rejects_Condition_With_Operator_Not_In_Metadata(LoginRuleConditionOperator op)
	{
		var store = CreateStore(TwoBackgroundsAndOneLogo);
		var controller = CreateController(store);
		LoginRuleConditionValue[] values = op is LoginRuleConditionOperator.Between or LoginRuleConditionOperator.NotBetween
			? [LoginRuleConditionValue.FromNumber(1), LoginRuleConditionValue.FromNumber(6)]
			: [LoginRuleConditionValue.FromNumber(1)];
		var request = new SaveRuleRequest
		{
			Name = "Unsupported operator",
			Enabled = true,
			Priority = 0,
			Condition = new LoginRuleConditionGroupModel(
				LoginRuleConditionGroupOperator.All,
				[new LoginRuleConditionModel("c1", LoginRuleField.Month, op, values)]),
			AssetIds = ["asset-a"]
		};

		await controller.Create(request);

		Assert.True(controller.ModelState.ContainsKey(nameof(SaveRuleRequest.Condition)));
		Assert.Empty(await store.GetAllRulesAsync());
	}

	private const string TwoBackgroundsAndOneLogo = """
		{
		  "assets": [
		    { "id": "asset-a", "name": "A", "kind": "background", "storagePath": "/tmp/a.jpg", "width": 10, "height": 10 },
		    { "id": "asset-b", "name": "B", "kind": "background", "storagePath": "/tmp/b.jpg", "width": 10, "height": 10 },
		    { "id": "logo-a", "name": "Logo", "kind": "logo", "storagePath": "/tmp/logo.svg", "width": 10, "height": 10 }
		  ],
		  "rules": []
		}
		""";

	private static SaveRuleRequest SaveRequest(string name, IReadOnlyList<string> assetIds, string? id = null, int priority = 100) => new()
	{
		Id = id,
		Name = name,
		Priority = priority,
		Enabled = true,
		Condition = new LoginRuleConditionGroupModel(LoginRuleConditionGroupOperator.All, []),
		AssetIds = assetIds,
	};

	private static LoginRule CreateRule(string id, string name, int priority, IReadOnlyList<string> assetIds) => new()
	{
		Id = id,
		Name = name,
		Priority = priority,
		Enabled = true,
		Condition = "{\"and\":[]}",
		AssetIds = assetIds,
	};

	public void Dispose()
	{
		if (Directory.Exists(_contentRootPath))
		{
			Directory.Delete(_contentRootPath, recursive: true);
		}
	}

	private static async Task<ActiveLeLøginScreenResponse> PreviewAsync(RuleController controller, string ruleId)
	{
		var result = Assert.IsType<OkObjectResult>(await controller.Preview(ruleId));
		return Assert.IsType<ActiveLeLøginScreenResponse>(result.Value);
	}

	private async Task CreateSourceImageAsync(string fileName)
	{
		var assetRoot = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets");
		Directory.CreateDirectory(assetRoot);
		using var image = new Image<Rgba32>(12, 12, Color.CornflowerBlue.ToPixel<Rgba32>());
		await image.SaveAsPngAsync(Path.Combine(assetRoot, fileName));
	}

	private string ToPublicFilePath(string imageUrl)
	{
		var path = imageUrl.Split('?')[0].TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
		return Path.Combine(_contentRootPath, "wwwroot", path);
	}

	private static FakeLeLøginScreenStore CreateStore(string configJson) =>
		FakeLeLøginScreenStoreSeed.FromConfigJson(configJson);

	private RuleController CreateController(FakeLeLøginScreenStore store)
	{
		var fileService = new LeLøginScreenFileService(
			TestFileSystems.AssetFileManager(_contentRootPath),
			TestFileSystems.PublishFileManager(_contentRootPath),
			new NullLogger<LeLøginScreenFileService>());
		return new RuleController(
			store,
			fileService,
			new LeLøginScreenRuntimeResolver(),
			new NullLogger<RuleController>(),
			Options.Create(new ImageSharpMiddlewareOptions()));
	}
}
