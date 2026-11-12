using LeLøgin.Core.Api.Assets;
using LeLøgin.Core.Api.Rules;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ApplicationModels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

using LeLøgin.Tests.Api.Assets;

namespace LeLøgin.Tests.Api;

/// <summary>Hosts management actions on Kestrel with MVC binding and isolated test dependencies.</summary>
internal static class ManagementTestHost
{
    public static WebApplication Create(UploadTestContext fixture, Func<RuleController>? createRuleController = null)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy(Umbraco.Cms.Web.Common.Authorization.AuthorizationPolicies.SectionAccessSettings,
                policy => policy.RequireAssertion(_ => true));
            options.AddPolicy(LeLøgin.Core.Api.Authorisation.LeLøginAuthorisationPolicies.ManageLeLøgin,
                policy => policy.RequireAssertion(_ => true));
        });
        builder.Services.AddControllers(options => options.Conventions.Add(new ManagementTestRoute(createRuleController is not null)))
            .AddApplicationPart(typeof(AssetController).Assembly)
            .AddControllersAsServices();
        builder.Services.AddTransient<AssetController>(_ => fixture.CreateController());
        if (createRuleController is not null) builder.Services.AddTransient<RuleController>(_ => createRuleController());
        var app = builder.Build();
        app.UseDeveloperExceptionPage();
        return app;
    }

    // Keep the real actions and MVC binding pipeline; replace only Umbraco routing and event messages.
    private sealed class ManagementTestRoute(bool includeRules) : IApplicationModelConvention
    {
        public void Apply(ApplicationModel application)
        {
            foreach (var controller in application.Controllers.ToArray())
            {
                if (controller.ControllerType != typeof(AssetController) &&
                    !(includeRules && controller.ControllerType == typeof(RuleController)))
                {
                    application.Controllers.Remove(controller);
                    continue;
                }
                foreach (var selector in controller.Selectors)
                    selector.AttributeRouteModel = new AttributeRouteModel(new RouteAttribute("upload-test"));
                foreach (var filter in controller.Filters.Where(filter => filter is Umbraco.Cms.Api.Management.Filters.AppendEventMessagesAttribute).ToArray())
                    controller.Filters.Remove(filter);
            }
        }
    }

}
