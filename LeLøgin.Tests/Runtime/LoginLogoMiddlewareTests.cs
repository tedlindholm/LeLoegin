using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;
using Xunit;

namespace LeLøgin.Tests.Runtime;

public sealed class LeLøginLogoMiddlewareTests : IDisposable
{
	private const string LogoUrl =
		"/umbraco/management/api/v1/security/back-office/graphics/login-logo";
	private const string LogoAlternativeUrl =
		"/umbraco/management/api/v1/security/back-office/graphics/login-logo-alternative";

	private readonly string _contentRootPath = Path.Combine(
		Path.GetTempPath(),
		"LeLøgin.Tests",
		Guid.NewGuid().ToString("N"));

	[Theory]
	[InlineData(LogoUrl)]
	[InlineData(LogoAlternativeUrl)]
	public async Task Falls_Through_Without_Store_Access_During_Installation(string path)
	{
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(RuntimeLevel.Install);

		await middleware.InvokeAsync(
			BuildContext(path),
			new Mock<ILeLøginScreenStore>(MockBehavior.Strict).Object,
			new LeLøginScreenRuntimeResolver(new StubRandom()),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			TestFileSystems.AssetFileManager(_contentRootPath),
			new NullLogger<LeLøginLogoMiddleware>(),
			runtimeState: runtimeState.Object);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Falls_Through_When_Path_Does_Not_Match()
	{
		var store = CreateStore(EmptyConfig);
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = new DefaultHttpContext();
		context.Request.Path = "/some/other/path";

		await InvokeAsync(middleware, context, store);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Serves_Resolved_Logo_File_For_Logo_Alternative_Endpoint()
	{
		// /login-logo-alternative is intercepted alongside /login-logo so the browser
		// receives Le Løgin's logo for both — Umbraco's bundled alternative no longer leaks.
		const string svgContent = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
		await WriteLogoFileAsync("logo-asset.svg", svgContent);
		var store = CreateStore(ConfigWithLogo);
		var middleware = new LeLøginLogoMiddleware(_ =>
			throw new InvalidOperationException("next should not be invoked when logo is served"));
		var context = BuildContext(LogoAlternativeUrl);
		var body = new MemoryStream();
		context.Response.Body = body;

		await InvokeAsync(middleware, context, store);

		body.Position = 0;
		using var reader = new StreamReader(body);
		var served = await reader.ReadToEndAsync();
		Assert.Equal(svgContent, served);
	}

	[Fact]
	public async Task Serves_Resolved_Logo_File_When_Asset_Matches()
	{
		const string svgContent = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
		await WriteLogoFileAsync("logo-asset.svg", svgContent);
		var store = CreateStore(ConfigWithLogo);
		var middleware = new LeLøginLogoMiddleware(_ =>
			throw new InvalidOperationException("next should not be invoked when logo is served"));
		var context = BuildContext(LogoUrl);
		var body = new MemoryStream();
		context.Response.Body = body;

		await InvokeAsync(middleware, context, store);

		body.Position = 0;
		using var reader = new StreamReader(body);
		var served = await reader.ReadToEndAsync();
		Assert.Equal(svgContent, served);
		Assert.Equal("image/svg+xml", context.Response.ContentType);
		Assert.Equal("nosniff", context.Response.Headers.XContentTypeOptions);
	}

	[Fact]
	public async Task Falls_Through_When_No_Rule_Matches()
	{
		await WriteLogoFileAsync("logo-asset.svg", "<svg/>");
		var store = CreateStore(ConfigWithLogoButRuleNeverMatches);
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = BuildContext(LogoUrl);

		await InvokeAsync(middleware, context, store);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Falls_Through_When_Active_Asset_Has_No_LogoAssetId()
	{
		var store = CreateStore(ConfigWithoutLogo);
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = BuildContext(LogoUrl);

		await InvokeAsync(middleware, context, store);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Falls_Through_When_Logo_File_Is_Missing_On_Disc()
	{
		// Deliberately do NOT create the logo file.
		var store = CreateStore(ConfigWithLogo);
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = BuildContext(LogoUrl);

		await InvokeAsync(middleware, context, store);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Falls_Through_When_Relative_Logo_StoragePath_Escapes_Asset_Root()
	{
		var store = CreateStore("""
		{
		  "assets": [
		    {
		      "id": "asset-bg",
		      "name": "Background",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": "logo-asset",
		      "storagePath": "assets/bg.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    },
		    {
		      "id": "logo-asset",
		      "name": "Logo",
		      "kind": 1,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "../../outside-safe-dir.svg",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
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
		""");
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = BuildContext(LogoUrl);

		await InvokeAsync(middleware, context, store);

		Assert.True(nextCalled);
	}

	[Fact]
	public async Task Falls_Through_When_Logo_Path_Escapes_Safe_Directory()
	{
		var unsafePath = Path.Combine(_contentRootPath, "..", "..", "outside-safe-dir.svg");
		Directory.CreateDirectory(Path.GetDirectoryName(unsafePath)!);
		await File.WriteAllTextAsync(unsafePath, "<svg/>");
		var unsafePathEscaped = unsafePath.Replace("\\", "\\\\", StringComparison.Ordinal);

		var store = CreateStore($$"""
		{
		  "assets": [
		    {
		      "id": "asset-bg",
		      "name": "Background",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": "logo-asset",
		      "storagePath": "assets/bg.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    },
		    {
		      "id": "logo-asset",
		      "name": "Logo",
		      "kind": 1,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{unsafePathEscaped}}",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
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
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");
		var nextCalled = false;
		var middleware = new LeLøginLogoMiddleware(_ =>
		{
			nextCalled = true;
			return Task.CompletedTask;
		});
		var context = BuildContext(LogoUrl);

		await InvokeAsync(middleware, context, store);

		Assert.True(nextCalled);
	}

	public void Dispose()
	{
		if (Directory.Exists(_contentRootPath))
		{
			Directory.Delete(_contentRootPath, recursive: true);
		}
	}

	private Task InvokeAsync(LeLøginLogoMiddleware middleware, HttpContext context, ILeLøginScreenStore store) =>
		middleware.InvokeAsync(
			context,
			store,
			new LeLøginScreenRuntimeResolver(new StubRandom()),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			TestFileSystems.AssetFileManager(_contentRootPath),
			new NullLogger<LeLøginLogoMiddleware>(),
			Mock.Of<IRuntimeState>(state => state.Level == RuntimeLevel.Run));

	private static DefaultHttpContext BuildContext(string path)
	{
		var context = new DefaultHttpContext();
		context.Request.Path = path;
		context.Request.Host = new HostString("localhost");
		return context;
	}

	private static FakeLeLøginScreenStore CreateStore(string configJson) =>
		FakeLeLøginScreenStoreSeed.FromConfigJson(configJson);

	private async Task<string> WriteLogoFileAsync(string fileName, string content)
	{
		var assetsDir = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "assets");
		Directory.CreateDirectory(assetsDir);
		var path = Path.Combine(assetsDir, fileName);
		await File.WriteAllTextAsync(path, content);
		return path;
	}

	private const string ConfigWithLogo = """
	{
	  "assets": [
	    {
	      "id": "asset-bg",
	      "name": "Background",
	      "kind": 0,
	      "altText": null,
	      "greetingText": null,
	      "logoAssetId": "logo-asset",
	      "storagePath": "assets/bg.png",
	      "publicPath": null,
	      "width": 1920,
	      "height": 1080,
	      "createdAt": "2026-05-15T00:00:00Z",
	      "updatedAt": "2026-05-15T00:00:00Z"
	    },
	    {
	      "id": "logo-asset",
	      "name": "Logo",
	      "kind": 1,
	      "altText": null,
	      "greetingText": null,
	      "logoAssetId": null,
	      "storagePath": "assets/logo-asset.svg",
	      "publicPath": null,
	      "width": 100,
	      "height": 100,
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
	  "settings": {
	    "publicEndpointCacheSeconds": 300
	  }
	}
	""";

	private const string ConfigWithoutLogo = """
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
	  "settings": {
	    "publicEndpointCacheSeconds": 300
	  }
	}
	""";

	private const string ConfigWithLogoButRuleNeverMatches = """
	{
	  "assets": [
	    {
	      "id": "asset-bg",
	      "name": "Background",
	      "kind": 0,
	      "altText": null,
	      "greetingText": null,
	      "logoAssetId": "logo-asset",
	      "storagePath": "assets/bg.png",
	      "publicPath": null,
	      "width": 1920,
	      "height": 1080,
	      "createdAt": "2026-05-15T00:00:00Z",
	      "updatedAt": "2026-05-15T00:00:00Z"
	    },
	    {
	      "id": "logo-asset",
	      "name": "Logo",
	      "kind": 1,
	      "altText": null,
	      "greetingText": null,
	      "logoAssetId": null,
	      "storagePath": "assets/logo.svg",
	      "publicPath": null,
	      "width": 100,
	      "height": 100,
	      "createdAt": "2026-05-15T00:00:00Z",
	      "updatedAt": "2026-05-15T00:00:00Z"
	    }
	  ],
	  "rules": [
	    {
	      "id": "r1",
	      "name": "Friday",
	      "priority": 100,
	      "enabled": true,
	      "condition": "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"friday\"]}]}",
	      "assetId": "asset-bg"
	    }
	  ],
	  "settings": {
	    "publicEndpointCacheSeconds": 300
	  }
	}
	""";

	private const string EmptyConfig = """
	{
	  "assets": [],
	  "settings": { "publicEndpointCacheSeconds": 300 },
	  "rules": []
	}
	""";

	private sealed class FixedTimeProvider(DateTimeOffset localNow) : TimeProvider
	{
		public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

		public override DateTimeOffset GetUtcNow() => localNow.ToUniversalTime();
	}
}
