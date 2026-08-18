using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web.Middleware;
using Xunit;

namespace LeLøgin.Tests.Api.Rules;

public sealed class RuleControllerTests : IDisposable
{
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
		Assert.Equal(new[] { "asset-a", "asset-b" }, model.AssetIds);

		var stored = await store.GetRuleAsync(model.Id);
		Assert.NotNull(stored);
		Assert.Equal(new[] { "asset-a", "asset-b" }, stored!.AssetIds);
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

	public void Dispose()
	{
		if (Directory.Exists(_contentRootPath))
		{
			Directory.Delete(_contentRootPath, recursive: true);
		}
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
			new NullLogger<RuleController>(),
			Options.Create(new ImageSharpMiddlewareOptions()));
	}
}
