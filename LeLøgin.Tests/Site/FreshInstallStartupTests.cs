using System.Collections.Concurrent;
using System.Net;
using LeLøgin.Core.Api.Authorisation;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;
using Xunit;

namespace LeLøgin.Tests.Site;

public sealed class FreshInstallStartupTests
{
	private static readonly string[] LoginGraphicsPaths =
	[
		"/umbraco/management/api/v1/security/back-office/graphics/login-background",
		"/umbraco/management/api/v1/security/back-office/graphics/login-logo",
		"/umbraco/management/api/v1/security/back-office/graphics/login-logo-alternative"
	];

	[Theory]
	[InlineData(false, RuntimeLevelReason.InstallNoDatabase)]
	[InlineData(true, RuntimeLevelReason.InstallEmptyDatabase)]
	public async Task Fresh_Site_Serves_The_Installer_And_Anonymous_Assets_Without_LeLøgin_Database_Errors(
		bool configureEmptySqlite,
		RuntimeLevelReason expectedReason)
	{
		await using var site = new FreshInstallSite(configureEmptySqlite);
		using var client = site.CreateClient(new WebApplicationFactoryClientOptions
		{
			AllowAutoRedirect = true
		});

		using var installerResponse = await client.GetAsync("/umbraco/");
		Assert.Equal(HttpStatusCode.OK, installerResponse.StatusCode);

		var runtimeState = site.Services.GetRequiredService<IRuntimeState>();
		Assert.Equal(RuntimeLevel.Install, runtimeState.Level);
		Assert.Equal(expectedReason, runtimeState.Reason);

		foreach (var path in LoginGraphicsPaths)
		{
			using var response = await client.GetAsync(path);
			Assert.True(
				response.IsSuccessStatusCode,
				$"Expected Umbraco's fallback graphic at {path}, but received {(int)response.StatusCode}.");
		}

		using var activeResponse = await client.GetAsync("/umbraco/le-l%C3%B8gin/api/v1/runtime/active");
		Assert.NotEqual(HttpStatusCode.InternalServerError, activeResponse.StatusCode);

		using var greetingResponse = await client.GetAsync("/umbraco/le-l%C3%B8gin/api/v1/runtime/greeting.js");
		Assert.NotEqual(HttpStatusCode.InternalServerError, greetingResponse.StatusCode);

		using var thumbnailResponse = await client.GetAsync(
			"/umbraco/le-l%C3%B8gin/api/v1/assets/not-installed/thumbnail");
		Assert.NotEqual(HttpStatusCode.InternalServerError, thumbnailResponse.StatusCode);

		Assert.DoesNotContain(site.DiagnosticEntries, entry =>
			entry.Contains("LeLøgin", StringComparison.Ordinal) &&
			(entry.Contains("proper connection string", StringComparison.OrdinalIgnoreCase) ||
			 entry.Contains("no such table", StringComparison.OrdinalIgnoreCase) ||
			 entry.Contains("ApplicationStartupException", StringComparison.Ordinal)));
	}

	[Fact]
	public async Task Unattended_Temporary_Install_Reaches_Run_With_LeLøgin_Storage_And_User_Group()
	{
		var installedContentRoot = string.Empty;
		await using (var installerSite = new FreshInstallSite(
			configureEmptySqlite: true,
			installUnattended: true,
			deleteContentRootOnDispose: false))
		{
			installedContentRoot = installerSite.ContentRootPath;
			using var installerClient = installerSite.CreateClient();
			using var installerResponse = await installerClient.GetAsync("/umbraco/");
			Assert.Equal(HttpStatusCode.OK, installerResponse.StatusCode);
			Assert.Equal(
				RuntimeLevel.Run,
				installerSite.Services.GetRequiredService<IRuntimeState>().Level);

			await using var installerScope = installerSite.Services.CreateAsyncScope();
			var store = installerScope.ServiceProvider.GetRequiredService<ILeLøginScreenStore>();
			Assert.NotNull(await store.GetSettingsAsync());
		}

		await using var runningSite = new FreshInstallSite(
			configureEmptySqlite: true,
			contentRootPath: installedContentRoot);
		using var runningClient = runningSite.CreateClient();
		using var runningResponse = await runningClient.GetAsync("/umbraco/");
		Assert.Equal(HttpStatusCode.OK, runningResponse.StatusCode);
		Assert.Equal(RuntimeLevel.Run, runningSite.Services.GetRequiredService<IRuntimeState>().Level);

		var groupWasProvisioned = await WaitForUserGroupProvisioningAsync(runningSite.Services);
		Assert.True(
			groupWasProvisioned,
			"The Le Løgin group was not provisioned after restart.");

		using var backgroundResponse = await runningClient.GetAsync(LoginGraphicsPaths[0]);
		Assert.True(backgroundResponse.IsSuccessStatusCode);
	}

	private static async Task<bool> WaitForUserGroupProvisioningAsync(IServiceProvider services)
	{
		for (var attempt = 0; attempt < 100; attempt++)
		{
			await using var scope = services.CreateAsyncScope();
			var store = scope.ServiceProvider.GetRequiredService<ILeLøginUserGroupStore>();
			var group = await store.GetByNameAsync(LeLøginUserGroupDefaults.GroupName);
			if (group is not null &&
				group.AllowedSections.Contains(Constants.Applications.Settings, StringComparer.Ordinal) &&
				group.Permissions.Contains(LeLøginPermissionVerbs.Manage, StringComparer.Ordinal))
			{
				return true;
			}

			await Task.Delay(TimeSpan.FromMilliseconds(50));
		}

		return false;
	}

	private sealed class FreshInstallSite : WebApplicationFactory<CachedStampAwareBackOfficeSignInManager>
	{
		private readonly bool _configureEmptySqlite;
		private readonly bool _installUnattended;
		private readonly bool _deleteContentRootOnDispose;
		private readonly string _contentRootPath;
		private readonly CapturingLoggerProvider _loggerProvider = new();

		public FreshInstallSite(
			bool configureEmptySqlite,
			bool installUnattended = false,
			string? contentRootPath = null,
			bool deleteContentRootOnDispose = true)
		{
			_configureEmptySqlite = configureEmptySqlite;
			_installUnattended = installUnattended;
			_deleteContentRootOnDispose = deleteContentRootOnDispose;
			_contentRootPath = contentRootPath ?? Path.Combine(
				Path.GetTempPath(),
				"LeLøgin.Tests",
				"FreshInstall",
				Guid.NewGuid().ToString("N"));
			Directory.CreateDirectory(_contentRootPath);
			Directory.CreateDirectory(Path.Combine(_contentRootPath, "wwwroot"));
		}

		public string ContentRootPath => _contentRootPath;

		public IReadOnlyCollection<string> DiagnosticEntries =>
			_loggerProvider.Entries.Concat(ReadLogFiles()).ToArray();

		protected override void ConfigureWebHost(IWebHostBuilder builder)
		{
			builder.UseContentRoot(_contentRootPath);
			builder.UseEnvironment(Environments.Production);
			builder.ConfigureAppConfiguration((_, configuration) =>
			{
				configuration.AddInMemoryCollection(BuildConfiguration());
			});
			builder.ConfigureLogging(logging => logging.AddProvider(_loggerProvider));
		}

		protected override void Dispose(bool disposing)
		{
			base.Dispose(disposing);
			if (!disposing)
			{
				return;
			}

			_loggerProvider.Dispose();
			if (_deleteContentRootOnDispose && Directory.Exists(_contentRootPath))
			{
				Directory.Delete(_contentRootPath, recursive: true);
			}
		}

		private IEnumerable<string> ReadLogFiles()
		{
			var logDirectory = Path.Combine(_contentRootPath, "umbraco", "Logs");
			return Directory.Exists(logDirectory)
				? Directory.EnumerateFiles(logDirectory, "*.json").Select(File.ReadAllText)
				: [];
		}

		private Dictionary<string, string?> BuildConfiguration()
		{
			var configuration = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
			{
				["ConnectionStrings:umbracoDbDSN"] = null,
				["ConnectionStrings:umbracoDbDSN_ProviderName"] = null,
				["Umbraco:CMS:Global:Id"] = Guid.NewGuid().ToString(),
				["Umbraco:CMS:Global:MainDomKeyDiscriminator"] = Guid.NewGuid().ToString("N"),
				["Umbraco:CMS:Logging:Directory"] = Path.Combine(_contentRootPath, "umbraco", "Logs"),
				["Umbraco:CMS:Unattended:UpgradeUnattended"] = "false"
			};

			if (!_configureEmptySqlite)
			{
				return configuration;
			}

			var dataDirectory = Path.Combine(_contentRootPath, "umbraco", "Data");
			Directory.CreateDirectory(dataDirectory);
			var databasePath = Path.Combine(dataDirectory, "Umbraco.sqlite.db");
			if (!File.Exists(databasePath))
			{
				using var databaseFile = File.Create(databasePath);
			}

			configuration["ConnectionStrings:umbracoDbDSN"] =
				$"Data Source={databasePath};Cache=Shared;Foreign Keys=True;Pooling=False";
			configuration["ConnectionStrings:umbracoDbDSN_ProviderName"] = "Microsoft.Data.Sqlite";

			if (_installUnattended)
			{
				configuration["Umbraco:CMS:Unattended:InstallUnattended"] = "true";
				configuration["Umbraco:CMS:Unattended:UnattendedUserName"] = "Fresh Install Test";
				configuration["Umbraco:CMS:Unattended:UnattendedUserEmail"] = "fresh-install@example.test";
				configuration["Umbraco:CMS:Unattended:UnattendedUserPassword"] = "FreshInstall!123456789";
				configuration["Umbraco:CMS:Unattended:UnattendedTelemetryLevel"] = "Minimal";
			}

			return configuration;
		}
	}

	private sealed class CapturingLoggerProvider : ILoggerProvider
	{
		private readonly ConcurrentQueue<string> _entries = new();

		public IReadOnlyCollection<string> Entries => _entries.ToArray();

		public ILogger CreateLogger(string categoryName) => new CapturingLogger(_entries, categoryName);

		public void Dispose()
		{
		}
	}

	private sealed class CapturingLogger(ConcurrentQueue<string> entries, string categoryName) : ILogger
	{
		public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

		public bool IsEnabled(LogLevel logLevel) => true;

		public void Log<TState>(
			LogLevel logLevel,
			EventId eventId,
			TState state,
			Exception? exception,
			Func<TState, Exception?, string> formatter)
		{
			entries.Enqueue($"{logLevel} {categoryName} {formatter(state, exception)} {exception}");
		}
	}
}
