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

		public void DeleteAsset(string assetId) => throw new NotSupportedException();

		public Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(LoginImageAsset imageAsset)
			=> Task.FromResult(new PublishedRuntimeAssetPaths("/login-screen/runtime-image-guid.jpg"));

		public Task<EncodedThumbnail> GetThumbnailAsync(LoginImageAsset asset)
			=> throw new NotSupportedException();
	}
}
