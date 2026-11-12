using System.Collections.Concurrent;
using LeLøgin.Core.Api.Authorisation;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LeLøgin.Tests.Site;

/// <summary>
/// A real Umbraco host on a temporary content root. Pass <c>configureEmptySqlite</c> for a SQLite
/// database that the host installs, so store and migration tests run against the real database.
/// </summary>
internal sealed class FreshInstallSite : WebApplicationFactory<CachedStampAwareBackOfficeSignInManager>
{
	private readonly bool _configureEmptySqlite;
	private readonly bool _installUnattended;
	private readonly bool _deleteContentRootOnDispose;
	private readonly string _contentRootPath;
	private readonly string _environmentName;
	private readonly CapturingLoggerProvider _loggerProvider = new();

	public FreshInstallSite(
		bool configureEmptySqlite,
		bool installUnattended = false,
		string? contentRootPath = null,
		bool deleteContentRootOnDispose = true,
		string? environmentName = null)
	{
		_configureEmptySqlite = configureEmptySqlite;
		_installUnattended = installUnattended;
		_deleteContentRootOnDispose = deleteContentRootOnDispose;
		_environmentName = environmentName ?? Environments.Production;
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
		builder.UseEnvironment(_environmentName);
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

internal sealed class CapturingLoggerProvider : ILoggerProvider
{
	private readonly ConcurrentQueue<string> _entries = new();

	public IReadOnlyCollection<string> Entries => _entries.ToArray();

	public ILogger CreateLogger(string categoryName) => new CapturingLogger(_entries, categoryName);

	public void Dispose()
	{
	}
}

internal sealed class CapturingLogger(ConcurrentQueue<string> entries, string categoryName) : ILogger
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
