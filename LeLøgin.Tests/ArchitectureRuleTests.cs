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
	[Fact]
	public void Production_Code_Never_References_Foreign_Cache_Keys_Or_Clears_Foreign_Caches()
	{
		var coreDirectory = FindCoreDirectory();
		var forbiddenFragments = new[]
		{
			// The internal cache key of Umbraco's PackageManifestService; mirroring it couples
			// Le Løgin to another package's cache lifetime and silently no-ops on rename.
			"PackageManifestService",
			// Clearing runtime-cache entries by key is only legitimate for keys Le Løgin owns;
			// no production code currently needs it at all, so any use is a rule violation.
			"ClearByKey",
		};

		var violations = Directory
			.EnumerateFiles(coreDirectory, "*.cs", SearchOption.AllDirectories)
			.SelectMany(file => forbiddenFragments
				.Where(fragment => File.ReadAllText(file).Contains(fragment, StringComparison.Ordinal))
				.Select(fragment => $"{Path.GetRelativePath(coreDirectory, file)}: {fragment}"))
			.ToList();

		Assert.Empty(violations);
	}

	private static string FindCoreDirectory()
	{
		var directory = new DirectoryInfo(AppContext.BaseDirectory);
		while (directory is not null)
		{
			var candidate = Path.Combine(directory.FullName, "Core");
			if (Directory.Exists(candidate) && File.Exists(Path.Combine(directory.FullName, "LeLøgin.csproj")))
			{
				return candidate;
			}

			directory = directory.Parent;
		}

		throw new InvalidOperationException("Could not locate the Core directory from the test base directory.");
	}
}
