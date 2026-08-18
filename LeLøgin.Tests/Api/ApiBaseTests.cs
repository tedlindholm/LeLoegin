using LeLøgin.Core.Api;
using LeLøgin.Core.Runtime;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// Guards the API URLs that are built outside the routing pipeline. A Razor view cannot ask
/// ASP.NET to generate these, so the path base has to be applied by hand — and a site hosted
/// under a virtual path is exactly where forgetting it goes unnoticed.
/// </summary>
public sealed class ApiBaseTests
{
	// The URL is emitted in URI-escaped form, so "ø" appears as "%C3%B8" — the same form
	// FreshInstallStartupTests requests over the wire.
	[Theory]
	[InlineData("", "/umbraco/le-l%C3%B8gin/api/v1/runtime/greeting.js?lr=7")]
	[InlineData("/cms", "/cms/umbraco/le-l%C3%B8gin/api/v1/runtime/greeting.js?lr=7")]
	[InlineData("/deep/nested", "/deep/nested/umbraco/le-l%C3%B8gin/api/v1/runtime/greeting.js?lr=7")]
	public void Greeting_Module_Url_Includes_The_Request_Path_Base(string pathBase, string expected)
	{
		var url = ApiBase.GetGreetingModuleUrl(new PathString(pathBase), renderToken: 7);

		Assert.Equal(expected, url);
	}

	[Fact]
	public void Greeting_Module_Url_Carries_The_Render_Token_So_It_Resolves_The_Displayed_Asset()
	{
		var url = ApiBase.GetGreetingModuleUrl(PathString.Empty, renderToken: -12345);

		Assert.EndsWith($"?{LoginRuntimeContextFactory.RenderTokenQueryKey}=-12345", url, StringComparison.Ordinal);
	}

	[Fact]
	public void Greeting_Module_Url_Shares_The_Runtime_Route_Prefix()
	{
		// Pins the substitution assumption documented on ApiBase: the route prefix already ends
		// in "v", so the apiVersion token has to render as bare "{Major}" for the hand-built
		// greeting URL to address the same endpoint the controller is routed on.
		var routePrefix = new PathString(ApiBase.RuntimeRouteTemplate.Replace(
			"{version:apiVersion}",
			ApiBase.Major,
			StringComparison.Ordinal)).ToString();
		var url = ApiBase.GetGreetingModuleUrl(PathString.Empty, renderToken: 0);

		Assert.StartsWith(routePrefix, url, StringComparison.Ordinal);
		Assert.Contains(ApiBase.GreetingModuleActionRoute, url, StringComparison.Ordinal);
	}
}
