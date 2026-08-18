using LeLøgin.Core.Api;
using LeLøgin.Core.Api.Authorisation;
using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using LeLøgin.Core.Storage.Migrations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.IO;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Web.Common.ApplicationBuilder;

namespace LeLøgin.Core;

/// <summary>
/// Registers all Login Screen services with Umbraco's DI container.
/// </summary>
public class LeLøginScreenComposer : IComposer
{
	public void Compose(IUmbracoBuilder builder)
	{
		builder.AddLeLøginOpenApiDocument();
		builder.Services.AddAuthorizationBuilder()
			.AddPolicy(LeLøginAuthorisationPolicies.ManageLeLøgin, policy =>
			{
				policy.RequireAuthenticatedUser();
				policy.Requirements.Add(new LeLøginPermissionRequirement(LeLøginPermissionVerbs.Manage));
			});
		// Authorisation handlers are long-lived by design in ASP.NET Core.
		builder.Services.AddSingleton<IAuthorizationHandler, LeLøginPermissionAuthorisationHandler>();
		builder.Services.TryAddScoped<ILeLøginUserGroupStore, UmbracoLeLøginUserGroupStore>();
		builder.Services.AddScoped<LeLøginUserGroupProvisioner>();

		// The store is backed by the Umbraco database via IScopeProvider; transient because each
		// public method opens and disposes its own scope.
		builder.Services.AddTransient<ILeLøginScreenStore, LeLøginScreenStore>();
		builder.Services.AddTransient<ILeLøginScreenFileService, LeLøginScreenFileService>();

		// Run schema creation and one-shot legacy-config import on UmbracoApplicationStarting.
		builder.AddNotificationAsyncHandler<UmbracoApplicationStartingNotification, LeLoginMigrationNotificationHandler>();

		// Register default PhysicalFileSystem-backed managers. Consumer composers running after
		// this one can override by calling SetLoginAssetFileSystem / SetLoginPublishFileSystem.
		builder.SetLoginAssetFileSystem(sp =>
		{
			var ioHelper = sp.GetRequiredService<IIOHelper>();
			var hostingEnv = sp.GetRequiredService<Umbraco.Cms.Core.Hosting.IHostingEnvironment>();
			var webHostEnv = sp.GetRequiredService<IWebHostEnvironment>();
			var logger = sp.GetRequiredService<ILogger<PhysicalFileSystem>>();
			return new PhysicalFileSystem(ioHelper, hostingEnv, logger,
				rootPath: Path.Combine(webHostEnv.ContentRootPath, "App_Data", "LeLøgin"),
				rootUrl: "/App_Data/LeLøgin");
		});

		builder.SetLoginPublishFileSystem(sp =>
		{
			var ioHelper = sp.GetRequiredService<IIOHelper>();
			var hostingEnv = sp.GetRequiredService<Umbraco.Cms.Core.Hosting.IHostingEnvironment>();
			var webHostEnv = sp.GetRequiredService<IWebHostEnvironment>();
			var logger = sp.GetRequiredService<ILogger<PhysicalFileSystem>>();
			return new PhysicalFileSystem(ioHelper, hostingEnv, logger,
				rootPath: Path.Combine(webHostEnv.WebRootPath, "login-screen"),
				rootUrl: "/login-screen");
		});

		// Prefer non-singleton where possible.
		builder.Services.AddTransient(_ => TimeProvider.System);
		// Randomness source for rules that resolve to multiple images; singleton wraps Random.Shared.
		builder.Services.AddSingleton<ILeLøginRandom, LeLøginRandom>();
		builder.Services.AddTransient<LeLøginScreenRuntimeResolver>();
		builder.AddNotificationAsyncHandler<UmbracoApplicationStartedNotification, LeLøginUserGroupProvisioningNotificationHandler>();

		// Inject the image-substitution middlewares before Umbraco's endpoint routing so they
		// can short-circuit the `/login-logo`, `/login-logo-alternative`, and `/login-background`
		// requests and serve the configured Le Løgin assets directly; without these filters the
		// middleware classes are unreachable and Umbraco's default BackOfficeGraphicsController
		// serves the bundled Umbraco defaults regardless of configuration.
		builder.Services.Configure<UmbracoPipelineOptions>(options =>
		{
			options.AddFilter(new UmbracoPipelineFilter(nameof(LeLøginLogoMiddleware))
			{
				PreRouting = app =>
				{
					app.UseMiddleware<LeLøginLogoMiddleware>();
					app.UseMiddleware<LeLøginBackgroundMiddleware>();
				},
			});
		});
	}
}
