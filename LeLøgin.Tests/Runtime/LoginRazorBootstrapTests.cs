using Xunit;

namespace LeLøgin.Tests.Runtime;

/// <summary>
/// Guards the package-owned login shell that makes the resolved greeting available before
/// Umbraco defines and connects <c>umb-auth</c>.
/// </summary>
public sealed class LoginRazorBootstrapTests
{
	[Fact]
	public void Package_Login_View_Supplies_Everything_The_Login_Entry_Reads()
	{
		var viewSource = ReadRepositoryFile("umbraco", "UmbracoLogin", "Index.cshtml");

		Assert.Contains("ApiBase.GetGreetingModuleUrl(Context.Request.PathBase)", viewSource, StringComparison.Ordinal);
		Assert.Contains("data-le-login-greeting-module", viewSource, StringComparison.Ordinal);
		Assert.Contains("data-le-login-culture", viewSource, StringComparison.Ordinal);
		Assert.Contains("data-umbraco-login-module", viewSource, StringComparison.Ordinal);
		Assert.Contains("/App_Plugins/le-løgin/login.js", viewSource, StringComparison.Ordinal);

		// Le Løgin's entry imports Umbraco's login bundle itself. A following module script does
		// not wait for a preceding module's top-level await, so leaving Umbraco's own script tag
		// in place would let it connect umb-auth while localisation was still loading.
		Assert.DoesNotContain("src=\"~/umbraco/login/login.js\"", viewSource, StringComparison.Ordinal);
	}

	[Fact]
	public void Login_Entry_Loads_The_Greeting_Before_Umbracos_Login_Bundle()
	{
		var source = ReadRepositoryFile("Client", "lib", "login-bootstrap.ts");

		var greetingRegistration = source.IndexOf("umbExtensionsRegistry.registerMany", StringComparison.Ordinal);
		var localisationLoad = source.IndexOf("umbLocalizationRegistry.loadLanguage", StringComparison.Ordinal);
		var loginImport = source.IndexOf("import(loginScriptUrl", StringComparison.Ordinal);

		Assert.True(greetingRegistration >= 0, "The login entry must register a greeting localisation manifest.");
		Assert.Contains("'localization'", source, StringComparison.Ordinal);
		Assert.True(localisationLoad > greetingRegistration, "The greeting must be registered before its culture is loaded.");
		Assert.True(loginImport > localisationLoad, "Umbraco login.js must start only after localisation is ready.");
		Assert.Contains("catch (error)", source, StringComparison.Ordinal);

		// Only Le Løgin's own manifest is registered here; Umbraco's slim login controller
		// registers its core manifests once after umb-auth connects.
		Assert.DoesNotContain("umbLocalizationManifests", source, StringComparison.Ordinal);
	}

	[Fact]
	public void The_Two_Entries_Stay_Independent_So_Neither_Page_Loads_The_Others_Code()
	{
		var loginEntry = ReadRepositoryFile("Client", "lib", "login-bootstrap.ts");
		var backofficeEntry = ReadRepositoryFile("Client", "lib", "backoffice-entry.ts");
		var packageManifest = ReadRepositoryFile("Client", "public", "umbraco-package.json");

		Assert.DoesNotContain("backoffice-entry", loginEntry, StringComparison.Ordinal);
		Assert.DoesNotContain("login-bootstrap", backofficeEntry, StringComparison.Ordinal);
		Assert.Contains("/App_Plugins/le-løgin/backoffice.js", packageManifest, StringComparison.Ordinal);
	}

	[Fact]
	public void Composer_Does_Not_Register_A_Late_Public_Greeting_Manifest()
	{
		var source = ReadRepositoryFile("Core", "LoginScreenComposer.cs");

		Assert.DoesNotContain("LeLøginPackageManifestReader", source, StringComparison.Ordinal);
	}

	private static string ReadRepositoryFile(params string[] relativePath) =>
		File.ReadAllText(Path.Combine([FindRepositoryRoot(), .. relativePath]));

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
