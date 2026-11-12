using System.Reflection;
using LeLøgin.Core.Api;
using LeLøgin.Core.Api.Runtime;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Xunit;

namespace LeLøgin.Tests.Api;

/// <summary>
/// Enforces the AGENTS.md security model: only the read-only runtime endpoints are public.
/// Source assets and anything derived from them must sit behind backoffice authentication.
/// </summary>
public sealed class PublicEndpointTests
{
	private static readonly string[] AllowedPublicRoutes =
	[
		ApiBase.GreetingModuleActionRoute,
	];

	[Fact]
	public void Only_The_Runtime_Endpoints_Are_Public()
	{
		var publicRoutes = ControllerTypes()
			.Where(type => type.IsAssignableTo(typeof(RuntimeControllerBase)))
			.SelectMany(ActionRoutes)
			.Order(StringComparer.Ordinal)
			.ToList();

		Assert.Equal(AllowedPublicRoutes.Order(StringComparer.Ordinal), publicRoutes);
	}

	[Fact]
	public void ActiveScreen_Requires_Backoffice_Authentication()
	{
		var owner = Assert.Single(
			ControllerTypes(),
			type => ActionRoutes(type).Contains("runtime/active"));

		Assert.True(owner.IsAssignableTo(typeof(ApiControllerBase)));
		Assert.NotEmpty(typeof(ApiControllerBase).GetCustomAttributes<AuthorizeAttribute>());
	}

	[Fact]
	public void Thumbnails_Require_Backoffice_Authentication()
	{
		var owner = Assert.Single(
			ControllerTypes(),
			type => ActionRoutes(type).Contains("assets/{id}/thumbnail"));

		Assert.True(owner.IsAssignableTo(typeof(ApiControllerBase)));
		Assert.NotEmpty(typeof(ApiControllerBase).GetCustomAttributes<AuthorizeAttribute>());
	}

	private static IEnumerable<Type> ControllerTypes() =>
		typeof(ApiControllerBase).Assembly.GetTypes()
			.Where(type => type is { IsAbstract: false, IsClass: true } && type.IsAssignableTo(typeof(ControllerBase)));

	private static IEnumerable<string> ActionRoutes(Type controller) =>
		controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
			.SelectMany(method => method.GetCustomAttributes<HttpMethodAttribute>())
			.Select(attribute => attribute.Template)
			.OfType<string>();
}
