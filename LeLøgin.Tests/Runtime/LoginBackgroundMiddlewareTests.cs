using LeLøgin.Core.Runtime;
using LeLøgin.Core.Models;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using SixLabors.ImageSharp.Web.Middleware;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;
using Xunit;

namespace LeLøgin.Tests.Runtime;

public sealed class LeLøginBackgroundMiddlewareTests
{
	private const string BackgroundUrl =
		"/umbraco/management/api/v1/security/back-office/graphics/login-background";

	[Fact]
	public async Task Falls_Through_Without_Store_Access_During_Installation()
	{
		var nextCalled = false;
		var middleware = new LeLøginBackgroundMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = new DefaultHttpContext();
		context.Request.Path = BackgroundUrl;
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(RuntimeLevel.Install);

		await middleware.InvokeAsync(
			context,
			new Mock<ILeLøginScreenStore>(MockBehavior.Strict).Object,
			new Mock<ILeLøginScreenFileService>(MockBehavior.Strict).Object,
			new LeLøginScreenRuntimeResolver(),
			TimeProvider.System,
			Options.Create(new ImageSharpMiddlewareOptions()),
			new NullLogger<LeLøginBackgroundMiddleware>(),
			runtimeState: runtimeState.Object);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Redirects_To_The_Resolved_Background_When_Umbraco_Is_Running()
	{
		var middleware = new LeLøginBackgroundMiddleware(_ =>
			throw new InvalidOperationException("The next middleware must not run when a background is resolved."));
		var context = new DefaultHttpContext();
		context.Request.Path = BackgroundUrl;
		context.Request.Host = new HostString("localhost");
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(RuntimeLevel.Run);

		await middleware.InvokeAsync(
			context,
			FakeLeLøginScreenStoreSeed.FromConfigJson(ConfigWithBackground),
			new StubFileService(),
			new LeLøginScreenRuntimeResolver(),
			TimeProvider.System,
			Options.Create(new ImageSharpMiddlewareOptions()),
			new NullLogger<LeLøginBackgroundMiddleware>(),
			runtimeState: runtimeState.Object);

		Assert.Equal(StatusCodes.Status302Found, context.Response.StatusCode);
		Assert.Equal("/login-screen/runtime-image-guid.jpg", context.Response.Headers.Location);
	}

	[Fact]
	public async Task Keeps_Every_Image_An_Enabled_Rule_Can_Show_Published()
	{
		var middleware = new LeLøginBackgroundMiddleware(_ =>
			throw new InvalidOperationException("The next middleware must not run when a background is resolved."));
		var context = new DefaultHttpContext();
		context.Request.Path = BackgroundUrl;
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(RuntimeLevel.Run);
		var fileService = new StubFileService();

		await middleware.InvokeAsync(
			context,
			StoreWithAnInactiveRuleImage(),
			fileService,
			new LeLøginScreenRuntimeResolver(),
			new FixedMayTimeProvider(),
			Options.Create(new ImageSharpMiddlewareOptions()),
			new NullLogger<LeLøginBackgroundMiddleware>(),
			runtimeState: runtimeState.Object);

		Assert.Equal("asset-live", fileService.PublishedImageAssetId);
		Assert.Equal(["asset-december", "asset-live"], fileService.KeptAssetIds);
	}

	/// <summary>
	/// A December rule that does not match today, a catch-all that does, a logo, and a
	/// background no rule uses. Only the two rule images may stay published.
	/// </summary>
	internal static FakeLeLøginScreenStore StoreWithAnInactiveRuleImage() => new FakeLeLøginScreenStore()
		.WithAsset(Background("asset-december"))
		.WithAsset(Background("asset-live"))
		.WithAsset(Background("asset-unused"))
		.WithAsset(new LoginImageAsset
		{
			Id = "asset-logo",
			Name = "asset-logo",
			Kind = LoginImageAssetKind.Logo,
			StoragePath = "assets/asset-logo.svg",
			Width = 120,
			Height = 48
		})
		.WithRule(new LoginRule
		{
			Id = "rule-december",
			Name = "December",
			Priority = 10,
			Enabled = true,
			Condition = "{\"and\":[{\"==\":[{\"var\":\"month\"},12]}]}",
			AssetIds = ["asset-december"]
		})
		.WithRule(new LoginRule
		{
			Id = "rule-catch-all",
			Name = "Catch-all",
			Priority = 20,
			Enabled = true,
			Condition = "{\"and\":[]}",
			AssetIds = ["asset-live"]
		});

	private static LoginImageAsset Background(string id) => new()
	{
		Id = id,
		Name = id,
		Kind = LoginImageAssetKind.Background,
		StoragePath = $"assets/{id}.png",
		Width = 1920,
		Height = 1080
	};

	private sealed class FixedMayTimeProvider : TimeProvider
	{
		public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

		public override DateTimeOffset GetUtcNow() => new(2026, 5, 18, 9, 0, 0, TimeSpan.Zero);
	}

	private const string ConfigWithBackground = """
	{
	  "assets": [
	    {
	      "id": "asset-bg",
	      "name": "Background",
	      "kind": 0,
	      "altText": null,
	      "greetingText": null,
	      "logoAssetId": null,
	      "storagePath": "assets/bg.png",
	      "publicPath": null,
	      "width": 1920,
	      "height": 1080,
	      "createdAt": "2026-05-15T00:00:00Z",
	      "updatedAt": "2026-05-15T00:00:00Z"
	    }
	  ],
	  "rules": [
	    {
	      "id": "r1",
	      "name": "All",
	      "priority": 100,
	      "enabled": true,
	      "condition": "{\"and\":[]}",
	      "assetId": "asset-bg"
	    }
	  ],
	  "settings": { "publicEndpointCacheSeconds": 300 }
	}
	""";

	private sealed class StubFileService : ILeLøginScreenFileService
	{
		public Task<(string storagePath, int width, int height)> SaveUploadAsync(string assetId, IFormFile file)
			=> throw new NotSupportedException();

		public void DeleteAsset(LoginImageAsset asset) => throw new NotSupportedException();

		public string? PublishedImageAssetId { get; private set; }

		public IReadOnlyList<string> KeptAssetIds { get; private set; } = [];

		public Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(
			LoginImageAsset imageAsset,
			IReadOnlyCollection<LoginImageAsset> assetsToKeepPublished)
		{
			PublishedImageAssetId = imageAsset.Id;
			KeptAssetIds = [.. assetsToKeepPublished.Select(asset => asset.Id).Order(StringComparer.Ordinal)];
			return Task.FromResult(new PublishedRuntimeAssetPaths("/login-screen/runtime-image-guid.jpg"));
		}

		public Task<EncodedThumbnail> GetThumbnailAsync(LoginImageAsset asset)
			=> throw new NotSupportedException();
	}
}
