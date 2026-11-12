using System.Net.Http.Json;
using System.Net;
using System.Text.Json.Nodes;
using LeLøgin.Core.Api.Rules;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Api.Assets;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web.Middleware;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>Checks JSON save requests through MVC binding and validation.</summary>
public sealed class SaveRequestHttpTests
{
    [Fact]
    public async Task Asset_Update_Accepts_A_Valid_Request()
    {
        using var fixture = new UploadTestContext();
        await fixture.Store.UpsertAssetAsync(new LoginImageAsset { Id = "background", Name = "Before", StoragePath = "assets/background.png" });
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };

        using var response = await client.PutAsJsonAsync("/upload-test/assets/background", new { name = "After" });

        Assert.True(response.StatusCode == HttpStatusCode.OK, await response.Content.ReadAsStringAsync());
        var asset = await response.Content.ReadFromJsonAsync<LoginImageAsset>();
        Assert.NotNull(asset);
        Assert.Equal("After", asset.Name);
        using var read = await client.GetAsync("/upload-test/assets/background");
        var saved = await read.Content.ReadFromJsonAsync<LoginImageAsset>();
        Assert.NotNull(saved);
        Assert.Equal("After", saved.Name);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Rule_Save_Accepts_A_Valid_Request(bool update)
    {
        using var fixture = new UploadTestContext();
        await SeedRuleAsync(fixture);
        await using var app = ManagementTestHost.Create(fixture, () => CreateRuleController(fixture));
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var request = new
        {
            name = "Monday", assetIds = new[] { "background" },
            condition = new
            {
                @operator = "all",
                conditions = new[] { new { id = "weekday", field = "weekday", @operator = "is", values = new[] { "monday" } } }
            }
        };

        using var response = update
            ? await client.PutAsJsonAsync("/upload-test/rules/existing", request)
            : await client.PostAsJsonAsync("/upload-test/rules", request);

        Assert.True(response.StatusCode == (update ? HttpStatusCode.OK : HttpStatusCode.Created),
            await response.Content.ReadAsStringAsync());
        var rule = await response.Content.ReadFromJsonAsync<LoginRuleResponseModel>();
        Assert.NotNull(rule);
        Assert.Equal("Monday", rule.Name);
        if (update) Assert.Equal("existing", rule.Id);
        using var read = await client.GetAsync($"/upload-test/rules/{rule.Id}");
        var saved = await read.Content.ReadFromJsonAsync<LoginRuleResponseModel>();
        Assert.NotNull(saved);
        Assert.Equal("Monday", saved.Name);
        var condition = Assert.Single(saved.Condition.Conditions);
        Assert.Equal(LoginRuleField.Weekday, condition.Field);
        Assert.Equal("monday", Assert.Single(condition.Values).Text);
    }

    [Theory]
    [InlineData("name", 200)]
    [InlineData("altText", 500)]
    [InlineData("greetingText", 500)]
    [InlineData("logoAssetId", 50)]
    public async Task Asset_Update_Enforces_Text_Length_Limits(string field, int maximum)
    {
        using var fixture = new UploadTestContext();
        await fixture.Store.UpsertAssetAsync(new LoginImageAsset
        {
            Id = "background", Name = "Before", StoragePath = "assets/background.png"
        });
        await fixture.Store.UpsertAssetAsync(new LoginImageAsset
        {
            Id = new string('a', 50), Name = "Logo", Kind = LoginImageAssetKind.Logo, StoragePath = "assets/logo.png"
        });
        await using var app = ManagementTestHost.Create(fixture);
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        var request = new Dictionary<string, string> { [field] = new string('a', maximum) };
        using var accepted = await client.PutAsJsonAsync("/upload-test/assets/background", request);
        Assert.True(accepted.StatusCode == HttpStatusCode.OK, await accepted.Content.ReadAsStringAsync());
        var before = await accepted.Content.ReadAsStringAsync();

        request[field] = new string('a', maximum + 1);
        using var rejected = await client.PutAsJsonAsync("/upload-test/assets/background", request);

        Assert.True(rejected.StatusCode == HttpStatusCode.BadRequest, await rejected.Content.ReadAsStringAsync());
        var problem = await rejected.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.Contains(problem.Errors.Keys, key => key.Equals(field, StringComparison.OrdinalIgnoreCase));
        using var read = await client.GetAsync("/upload-test/assets/background");
        Assert.Equal(before, await read.Content.ReadAsStringAsync());
    }

    public static IEnumerable<object[]> MissingRuleFields()
    {
        string[] fields = ["condition", "condition.conditions", "condition.operator", "id", "field", "operator", "values"];
        foreach (var update in new[] { false, true })
        foreach (var explicitNull in new[] { false, true })
        foreach (var field in fields)
            yield return [update, explicitNull, field];
    }

    [Theory]
    [MemberData(nameof(MissingRuleFields))]
    public async Task Rule_Save_Rejects_Missing_Required_Condition_Fields(bool update, bool explicitNull, string field)
    {
        using var fixture = new UploadTestContext();
        await SeedRuleAsync(fixture);
        await using var app = ManagementTestHost.Create(fixture, () => CreateRuleController(fixture));
        app.MapControllers().AllowAnonymous();
        await app.StartAsync();
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        using var before = await client.GetAsync("/upload-test/rules");
        var beforeJson = await before.Content.ReadAsStringAsync();
        var request = JsonNode.Parse("""
            {"name":"Monday","assetIds":["background"],"condition":{"operator":"all","conditions":[
                {"id":"weekday","field":"weekday","operator":"is","values":["monday"]}
            ]}}
            """)!.AsObject();
        var conditionGroup = request["condition"]!.AsObject();
        var condition = conditionGroup["conditions"]![0]!.AsObject();
        var target = field == "condition" ? request : field.StartsWith("condition.", StringComparison.Ordinal) ? conditionGroup : condition;
        var property = field.StartsWith("condition.", StringComparison.Ordinal) ? field["condition.".Length..] : field;
        if (explicitNull) target[property] = null;
        else target.Remove(property);

        using var response = update
            ? await client.PutAsJsonAsync("/upload-test/rules/existing", request)
            : await client.PostAsJsonAsync("/upload-test/rules", request);

        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync());
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>();
        Assert.NotNull(problem);
        Assert.NotEmpty(problem.Errors);
        using var read = await client.GetAsync("/upload-test/rules");
        Assert.Equal(beforeJson, await read.Content.ReadAsStringAsync());
    }

    private static async Task SeedRuleAsync(UploadTestContext fixture)
    {
        await fixture.Store.UpsertAssetAsync(new LoginImageAsset
        {
            Id = "background", Name = "Background", StoragePath = "assets/background.png"
        });
        await fixture.Store.UpsertRuleAsync(new LoginRule
        {
            Id = "existing", Name = "Before", Condition = "{\"and\":[]}", AssetIds = ["background"]
        });
    }

    private static RuleController CreateRuleController(UploadTestContext fixture) => new(
        fixture.Store,
        new LeLøginScreenFileService(TestFileSystems.AssetFileManager(fixture.Root),
            TestFileSystems.PublishFileManager(fixture.Root), NullLogger<LeLøginScreenFileService>.Instance),
        new LeLøginScreenRuntimeResolver(), NullLogger<RuleController>.Instance,
        Options.Create(new ImageSharpMiddlewareOptions()));
}
