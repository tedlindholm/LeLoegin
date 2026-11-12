using Xunit;

namespace LeLøgin.Tests;

/// <summary>
/// Enforces AGENTS.md Backend Key Rule 9: Le Løgin must never clear, mutate, mirror the
/// keys of, or depend on the lifetime of caches it does not own. Umbraco's
/// <c>PackageManifestService</c> runtime-cache entry aggregates every package's manifests
/// site-wide, so clearing it to refresh Le Løgin state invalidates the whole site's
/// manifest cache. Freshness is delivered by resolving state per request at Le Løgin-owned
/// endpoints instead.
/// </summary>
public sealed class ArchitectureRuleTests
{
	/// <summary>
	/// Directories holding shipped production code, relative to the repository root. Every
	/// project that ends up in a consumer's application must be covered — a rule that only
	/// guards <c>Core</c> would let an add-on package clear a foreign cache unnoticed.
	/// </summary>
	private static readonly string[] ProductionDirectories =
	[
		"Core",
		"LeLøgin.AzureBlob",
	];

	private static readonly string[] ForbiddenFragments =
	[
		// The internal cache key of Umbraco's PackageManifestService; mirroring it couples
		// Le Løgin to another package's cache lifetime and silently no-ops on rename.
		"PackageManifestService",
		// Clearing runtime-cache entries by key is only legitimate for keys Le Løgin owns;
		// no production code currently needs it at all, so any use is a rule violation.
		"ClearByKey",
	];

	[Fact]
	public void Production_Code_Never_References_Foreign_Cache_Keys_Or_Clears_Foreign_Caches()
	{
		var repositoryRoot = FindRepositoryRoot();

		var violations = ProductionSourceFiles(repositoryRoot)
			.SelectMany(file =>
			{
				var source = File.ReadAllText(file);
				return ForbiddenFragments
					.Where(fragment => source.Contains(fragment, StringComparison.Ordinal))
					.Select(fragment => $"{Path.GetRelativePath(repositoryRoot, file)}: {fragment}");
			})
			.ToList();

		Assert.Empty(violations);
	}

	/// <summary>
	/// Guards the guard: proves the scan actually reads the production sources and would fail
	/// on a violation. Without this, an empty or mis-rooted file set would make the rule above
	/// pass vacuously for ever.
	/// </summary>
	[Fact]
	public void Rule_Scan_Covers_Every_Production_Project_And_Detects_A_Violation()
	{
		var repositoryRoot = FindRepositoryRoot();
		var files = ProductionSourceFiles(repositoryRoot).ToList();

		Assert.All(ProductionDirectories, directory =>
			Assert.Contains(
				files,
				file => file.StartsWith(
					Path.Combine(repositoryRoot, directory) + Path.DirectorySeparatorChar,
					StringComparison.Ordinal)));

		// The fragments must match the real Umbraco API surface, not a typo that can never hit:
		// both appear verbatim in the deleted invalidator this rule exists to keep deleted.
		var sampleViolation = "appCaches.RuntimeCache.ClearByKey(\"PackageManifestService-PackageManifests\")";
		Assert.All(ForbiddenFragments, fragment =>
			Assert.Contains(fragment, sampleViolation, StringComparison.Ordinal));
	}

	/// <summary>
	/// Le Løgin does not use Newtonsoft.Json (decided 11 November 2026, AGENTS.md Key Rule 19):
	/// System.Text.Json is what Umbraco and ASP.NET use. Covers source files and the shipped
	/// project files, so neither a <c>using</c> nor a package reference can slip back in.
	/// </summary>
	[Fact]
	public void Production_Code_And_Projects_Never_Use_Newtonsoft()
	{
		var repositoryRoot = FindRepositoryRoot();
		var projectFiles = new[]
		{
			Path.Combine(repositoryRoot, "LeLøgin.csproj"),
			Path.Combine(repositoryRoot, "LeLøgin.AzureBlob", "LeLøgin.AzureBlob.csproj"),
			Path.Combine(repositoryRoot, "Directory.Build.props"),
		};

		var violations = ProductionSourceFiles(repositoryRoot)
			.Concat(projectFiles)
			.Where(file => File.ReadAllText(file).Contains("Newtonsoft", StringComparison.OrdinalIgnoreCase))
			.Select(file => Path.GetRelativePath(repositoryRoot, file))
			.ToList();

		Assert.All(projectFiles, file => Assert.True(File.Exists(file), $"Expected project file {file}."));
		Assert.Empty(violations);
	}

	private static IEnumerable<string> ProductionSourceFiles(string repositoryRoot) =>
		ProductionDirectories
			.Select(directory => Path.Combine(repositoryRoot, directory))
			.Where(Directory.Exists)
			.SelectMany(directory => Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories))
			// obj/ holds generated copies of source that would double-report a violation.
			.Where(file => !file.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal));

	private static string FindRepositoryRoot()
	{
		var directory = new DirectoryInfo(AppContext.BaseDirectory);
		while (directory is not null)
		{
			if (File.Exists(Path.Combine(directory.FullName, "LeLøgin.csproj")))
			{
				return directory.FullName;
			}

			directory = directory.Parent;
		}

		throw new InvalidOperationException("Could not locate the repository root from the test base directory.");
	}
}
