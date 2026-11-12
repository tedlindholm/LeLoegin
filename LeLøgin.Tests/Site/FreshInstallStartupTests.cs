using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;
using LeLøgin.Core.Api;
using LeLøgin.Core.Api.Authorisation;
using LeLøgin.Core.Storage;
using LeLøgin.Tests.Api;
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
			Assert.Empty(await store.GetAllRulesAsync());
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

	[Fact]
	public async Task Installed_Site_Serves_The_Le_Løgin_OpenApi_Document()
	{
		await using var site = new FreshInstallSite(
			configureEmptySqlite: true,
			installUnattended: true,
			environmentName: Environments.Development);
		using var client = site.CreateClient();
		using var bootResponse = await client.GetAsync("/umbraco/");
		Assert.Equal(HttpStatusCode.OK, bootResponse.StatusCode);
		Assert.Equal(RuntimeLevel.Run, site.Services.GetRequiredService<IRuntimeState>().Level);

		using var response = await client.GetAsync(OpenApiDocumentPath);
		var body = await response.Content.ReadAsStringAsync();
		Assert.True(
			response.IsSuccessStatusCode,
			$"Expected the Le Løgin OpenAPI document at {OpenApiDocumentPath}, but received {(int)response.StatusCode}. {body}");

		var document = JsonNode.Parse(body) ?? throw new InvalidOperationException("The OpenAPI document was empty.");
		var outputDirectory = Path.Combine(RepositoryRoot(), "artifacts", "openapi");
		Directory.CreateDirectory(outputDirectory);
		var pretty = document.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
		await File.WriteAllTextAsync(Path.Combine(outputDirectory, OpenApiDocumentFileName), pretty + "\n");

		Assert.Equal("Løgin API v1", document["info"]?["title"]?.GetValue<string>());
		OpenApiSharedContract.AssertMatchesFixture(
			document,
			Path.Combine(RepositoryRoot(), "LeLøgin.Tests", "Api", "openapi-shared-contract.json"));

		var paths = document["paths"]?.AsObject()
			?? throw new InvalidOperationException("The OpenAPI document has no paths.");
		Assert.Contains(
			paths.Select(path => path.Key),
			path => path.Contains("/le-l", StringComparison.Ordinal) && path.Contains("/rules", StringComparison.Ordinal));
		Assert.DoesNotContain(
			paths.Select(path => path.Key),
			path => path.Contains("/le-l", StringComparison.Ordinal) && path.EndsWith("/settings", StringComparison.Ordinal));

	}

	private static string OpenApiDocumentPath
	{
		get
		{
			var documentName = Uri.EscapeDataString(ApiBase.LeLøginScreenApiName);
#if UMBRACO_17
			return $"/umbraco/swagger/{documentName}/swagger.json";
#else
			return $"/umbraco/openapi/{documentName}.json";
#endif
		}
	}

	private static string OpenApiDocumentFileName
	{
		get
		{
#if UMBRACO_17
			return "v17.json";
#else
			return "v18.json";
#endif
		}
	}

	private static string RepositoryRoot()
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

		throw new InvalidOperationException("Could not find the Le Løgin repository root.");
	}

	private static async Task<bool> WaitForUserGroupProvisioningAsync(IServiceProvider services)
	{
		for (var attempt = 0; attempt < 100; attempt++)
		{
			await using var scope = services.CreateAsyncScope();
			var store = scope.ServiceProvider.GetRequiredService<ILeLøginUserGroupStore>();
			var group = await store.GetAsync(LeLøginUserGroupDefaults.GroupAlias);
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
}
