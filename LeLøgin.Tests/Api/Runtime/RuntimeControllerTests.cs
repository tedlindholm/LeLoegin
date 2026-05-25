using LeLøgin.Core.Api.Runtime;
using LeLøgin.Core.Models;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Storage;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SixLabors.ImageSharp.Web.Middleware;
using Xunit;

namespace LeLøgin.Tests.Api.Runtime;

public sealed class RuntimeControllerTests : IDisposable
{
	private readonly string _contentRootPath = Path.Combine(
		Path.GetTempPath(),
		"LeLøgin.Tests",
		Guid.NewGuid().ToString("N"));

	[Fact]
	public async Task GetActive_Publishes_The_Resolved_Rule_Assets_And_Returns_Guid_Backed_Public_Paths()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-default",
		      "name": "Default",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Default",
		      "logoAssetId": null,
		      "storagePath": "assets/default-background.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    },
		    {
		      "id": "asset-rule",
		      "name": "Matched",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Matched",
		      "logoAssetId": "logo-rule",
		      "storagePath": "assets/rule-background.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-16T00:00:00Z",
		      "updatedAt": "2026-05-16T00:00:00Z"
		    },
		    {
		      "id": "logo-rule",
		      "name": "Matched logo",
		      "kind": 1,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "assets/rule-logo.svg",
		      "publicPath": null,
		      "width": 120,
		      "height": 48,
		      "createdAt": "2026-05-16T00:00:01Z",
		      "updatedAt": "2026-05-16T00:00:01Z"
		    }
		  ],
		  "rules": [
		    {
		      "id": "rule-1",
		      "name": "Monday",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}",
		      "assetId": "asset-rule"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var fileService = new RecordingFileService();
		var controller = new RuntimeController(
			store,
			fileService,
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext()
			}
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		var result = Assert.IsType<OkObjectResult>(await controller.GetActive());
		var response = Assert.IsType<ActiveLeLøginScreenResponse>(result.Value);

		Assert.Equal("asset-rule", fileService.PublishedImageAssetId);
		Assert.Equal("asset-rule", response.AssetId);
		Assert.Equal("/login-screen/runtime-image-guid.jpg", response.ImageUrl);
		Assert.Equal("Matched", response.GreetingText);
	}

	[Fact]
	public async Task GetActive_Uses_The_Catch_All_Rule_When_No_Conditional_Rule_Matches()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-catch-all",
		      "name": "Catch-all",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Always",
		      "logoAssetId": null,
		      "storagePath": "assets/catch-all-background.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    },
		    {
		      "id": "asset-rule",
		      "name": "Matched",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Matched",
		      "logoAssetId": null,
		      "storagePath": "assets/rule-background.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-16T00:00:00Z",
		      "updatedAt": "2026-05-16T00:00:00Z"
		    }
		  ],
		  "rules": [
		    {
		      "id": "rule-1",
		      "name": "Monday",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}",
		      "assetId": "asset-rule"
		    },
		    {
		      "id": "rule-2",
		      "name": "Catch-all",
		      "priority": 200,
		      "enabled": true,
		      "condition": "{\"and\":[]}",
		      "assetId": "asset-catch-all"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var fileService = new RecordingFileService();
		var controller = new RuntimeController(
			store,
			fileService,
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 20, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext()
			}
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		var result = Assert.IsType<OkObjectResult>(await controller.GetActive());
		var response = Assert.IsType<ActiveLeLøginScreenResponse>(result.Value);

		Assert.Equal(1, fileService.RuntimePublicationCallCount);
		Assert.Equal("asset-catch-all", fileService.PublishedImageAssetId);
		Assert.Equal("asset-catch-all", response.AssetId);
		Assert.Equal("Always", response.GreetingText);
		Assert.Equal("/login-screen/runtime-image-guid.jpg", response.ImageUrl);
	}

	[Fact]
	public async Task GetActive_Returns_NoContent_When_No_Rule_Matches_And_No_Catch_All_Rule_Exists()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-rule",
		      "name": "Matched",
		      "kind": 0,
		      "altText": null,
		      "greetingText": "Matched",
		      "logoAssetId": null,
		      "storagePath": "assets/rule-background.png",
		      "publicPath": null,
		      "width": 1920,
		      "height": 1080,
		      "createdAt": "2026-05-16T00:00:00Z",
		      "updatedAt": "2026-05-16T00:00:00Z"
		    }
		  ],
		  "rules": [
		    {
		      "id": "rule-1",
		      "name": "Monday",
		      "priority": 100,
		      "enabled": true,
		      "condition": "{\"and\":[{\"==\":[{\"var\":\"weekday\"},\"monday\"]}]}",
		      "assetId": "asset-rule"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var fileService = new RecordingFileService();
		var controller = new RuntimeController(
			store,
			fileService,
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 20, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext()
			}
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		Assert.IsType<NoContentResult>(await controller.GetActive());
		Assert.Equal(0, fileService.RuntimePublicationCallCount);
		Assert.Null(fileService.PublishedImageAssetId);
	}

	[Fact]
	public async Task Thumbnail_Returns_NotFound_When_Asset_Does_Not_Exist()
	{
		WriteConfig("""
		{
		  "assets": [],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(_contentRootPath),
				TestFileSystems.PublishFileManager(_contentRootPath),
				new NullLogger<LeLøginScreenFileService>()),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext()
			}
		};

		var result = await controller.Thumbnail("nonexistent-asset");

		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task Thumbnail_Returns_NotFound_When_Source_File_Missing()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-missing-file",
		      "name": "Missing",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "assets/nonexistent-file.png",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(_contentRootPath),
				TestFileSystems.PublishFileManager(_contentRootPath),
				new NullLogger<LeLøginScreenFileService>()),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext()
			}
		};

		var result = await controller.Thumbnail("asset-missing-file");

		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task Thumbnail_Returns_NotFound_When_Relative_StoragePath_Escapes_Asset_Root()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-traversal",
		      "name": "Traversal",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "../../etc/passwd",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": { "publicEndpointCacheSeconds": 300 },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(_contentRootPath),
				TestFileSystems.PublishFileManager(_contentRootPath),
				new NullLogger<LeLøginScreenFileService>()),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
		};

		var result = await controller.Thumbnail("asset-traversal");

		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task Thumbnail_Returns_NotFound_When_Path_Is_Outside_Allowed_Directory()
	{
		var unsafePath = Path.Combine(_contentRootPath, "..", "../../etc/passwd");
		Directory.CreateDirectory(Path.GetDirectoryName(unsafePath)!);
		File.WriteAllText(unsafePath, "unsafe");

		WriteConfig($$"""
		{
		  "assets": [
		    {
		      "id": "asset-malicious",
		      "name": "Malicious",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "storagePath": "{{unsafePath.Replace("\\", "\\\\", StringComparison.Ordinal)}}",
		      "publicPath": null,
		      "width": 100,
		      "height": 100,
		      "createdAt": "2026-05-15T00:00:00Z",
		      "updatedAt": "2026-05-15T00:00:00Z"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  },
		  "rules": []
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new LeLøginScreenFileService(
				TestFileSystems.AssetFileManager(_contentRootPath),
				TestFileSystems.PublishFileManager(_contentRootPath),
				new NullLogger<LeLøginScreenFileService>()),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext
			{
				HttpContext = new DefaultHttpContext()
			}
		};

		var result = await controller.Thumbnail("asset-malicious");

		Assert.IsType<NotFoundResult>(result);
	}

	[Fact]
	public async Task GetActive_Emits_Cc_Query_When_Asset_Has_Zoom_Greater_Than_One()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-zoomed",
		      "name": "Zoomed",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "focalPoint": {
		        "left": 0.3,
		        "top": 0.6
		      },
		      "zoom": 2.0,
		      "storagePath": "assets/zoomed.png",
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
		      "assetId": "asset-zoomed"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new RecordingFileService(),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		var result = Assert.IsType<OkObjectResult>(await controller.GetActive());
		var response = Assert.IsType<ActiveLeLøginScreenResponse>(result.Value);

		// fp=(0.3, 0.6), zoom=2 → half = 0.25 → x1=0.05, x2=0.55, y1=0.35, y2=0.85
		// cc = "0.05,0.35,0.45,0.15" (insets from each edge, "0.####" format with dropped trailing zeros)
		// Comma encoding varies (Uri.EscapeDataString in some hosts emits raw "," here).
		var decoded = Uri.UnescapeDataString(response.ImageUrl);
		Assert.Contains("cc=0.05,0.35,0.45,0.15", decoded);
		Assert.DoesNotContain("rxy=", decoded);
	}

	[Fact]
	public async Task GetActive_Emits_Rxy_Query_When_Asset_Has_Focal_Point_But_Zoom_Equals_One()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-fp-only",
		      "name": "Fp only",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "focalPoint": {
		        "left": 0.25,
		        "top": 0.75
		      },
		      "zoom": 1.0,
		      "storagePath": "assets/fp.png",
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
		      "assetId": "asset-fp-only"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new RecordingFileService(),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		var result = Assert.IsType<OkObjectResult>(await controller.GetActive());
		var response = Assert.IsType<ActiveLeLøginScreenResponse>(result.Value);

		var decoded = Uri.UnescapeDataString(response.ImageUrl);
		Assert.Contains("rmode=crop", decoded);
		Assert.Contains("rxy=0.25,0.75", decoded);
		Assert.DoesNotContain("cc=", decoded);
		Assert.NotNull(response.FocalPoint);
		Assert.Equal(0.25, response.FocalPoint!.Left);
		Assert.Equal(0.75, response.FocalPoint.Top);
		Assert.Equal(1.0, response.Zoom);
	}

	[Fact]
	public async Task GetActive_Emits_Base_Url_Without_Query_When_Neither_Focal_Point_Nor_Zoom_Set()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-plain",
		      "name": "Plain",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "zoom": 1.0,
		      "storagePath": "assets/plain.png",
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
		      "assetId": "asset-plain"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var controller = new RuntimeController(
			store,
			new RecordingFileService(),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			new NullLogger<RuntimeController>(),
			TestFileSystems.AssetFileManager(_contentRootPath),
			Options.Create(new ImageSharpMiddlewareOptions()))
		{
			ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		var result = Assert.IsType<OkObjectResult>(await controller.GetActive());
		var response = Assert.IsType<ActiveLeLøginScreenResponse>(result.Value);

		Assert.DoesNotContain("?", response.ImageUrl);
	}

	[Fact]
	public async Task GetActive_Warns_When_Hmac_Configured_But_Signer_Is_Null()
	{
		WriteConfig("""
		{
		  "assets": [
		    {
		      "id": "asset-zoomed",
		      "name": "Zoomed",
		      "kind": 0,
		      "altText": null,
		      "greetingText": null,
		      "logoAssetId": null,
		      "focalPoint": {
		        "left": 0.5,
		        "top": 0.5
		      },
		      "zoom": 2.0,
		      "storagePath": "assets/z.png",
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
		      "assetId": "asset-zoomed"
		    }
		  ],
		  "settings": {
		    "publicEndpointCacheSeconds": 300
		  }
		}
		""");

		var store = CreateStore();
		var logger = new CapturingLogger<RuntimeController>();
		var options = Options.Create(new ImageSharpMiddlewareOptions { HMACSecretKey = new byte[] { 1, 2, 3, 4 } });
		var controller = new RuntimeController(
			store,
			new RecordingFileService(),
			new LeLøginScreenRuntimeResolver(),
			new FixedTimeProvider(new DateTimeOffset(2026, 5, 18, 9, 0, 0, TimeSpan.Zero)),
			logger,
			TestFileSystems.AssetFileManager(_contentRootPath),
			options,
			requestAuthorizationUtilities: null)
		{
			ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
		};
		controller.ControllerContext.HttpContext.Request.Host = new HostString("localhost");

		Assert.IsType<OkObjectResult>(await controller.GetActive());

		Assert.Contains(logger.Entries, entry =>
			entry.Level == LogLevel.Warning &&
			entry.Message.Contains("HMAC is configured", StringComparison.Ordinal));
	}

	public void Dispose()
	{
		if (Directory.Exists(_contentRootPath))
		{
			Directory.Delete(_contentRootPath, recursive: true);
		}
	}

	private FakeLeLøginScreenStore CreateStore()
	{
		var configPath = Path.Combine(_contentRootPath, "App_Data", "LeLøgin", "config.json");
		var json = File.Exists(configPath) ? File.ReadAllText(configPath) : "{}";
		return FakeLeLøginScreenStoreSeed.FromConfigJson(json);
	}

	private void WriteConfig(string json)
	{
		var configDirectory = Path.Combine(_contentRootPath, "App_Data", "LeLøgin");
		Directory.CreateDirectory(configDirectory);
		File.WriteAllText(Path.Combine(configDirectory, "config.json"), json);
	}

	private sealed class RecordingFileService : ILeLøginScreenFileService
	{
		public int RuntimePublicationCallCount { get; private set; }
		public string? PublishedImageAssetId { get; private set; }

		public Task<(string storagePath, int width, int height)> SaveUploadAsync(string assetId, IFormFile file) =>
			throw new NotSupportedException();

		public void DeleteAsset(string assetId) => throw new NotSupportedException();

		public Task<PublishedRuntimeAssetPaths> EnsureRuntimeAssetsAsync(LoginImageAsset imageAsset)
		{
			RuntimePublicationCallCount++;
			PublishedImageAssetId = imageAsset.Id;
			return Task.FromResult(new PublishedRuntimeAssetPaths(
				"/login-screen/runtime-image-guid.jpg"));
		}

		public Task<EncodedThumbnail> GetThumbnailAsync(LoginImageAsset asset) =>
			throw new NotSupportedException();
	}

	private sealed class FixedTimeProvider(DateTimeOffset localNow) : TimeProvider
	{
		public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;

		public override DateTimeOffset GetUtcNow() => localNow.ToUniversalTime();
	}


	private sealed class CapturingLogger<T> : ILogger<T>
	{
		public List<(LogLevel Level, string Message)> Entries { get; } = new();
		public IDisposable BeginScope<TState>(TState state) where TState : notnull => NullScope.Instance;
		public bool IsEnabled(LogLevel logLevel) => true;
		public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
		{
			Entries.Add((logLevel, formatter(state, exception)));
		}

		private sealed class NullScope : IDisposable
		{
			public static readonly NullScope Instance = new();
			public void Dispose() { }
		}
	}
}
