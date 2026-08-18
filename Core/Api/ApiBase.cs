using Microsoft.AspNetCore.Http;

namespace LeLøgin.Core.Api;

/// <summary>
/// API identity constants for the Login Screen API.
/// </summary>
public static class ApiBase
{
	public const string Major = "1";
	public const string Minor = "0";
	public const string LeLøginScreenApiName = $"le-løgin-api-v{Major}";
	public const string LeLøginScreenApiVersion = $"{Major}.{Minor}";

	/// <summary>
	/// Everything in a Le Løgin API URL before the version number. Sole source of the route
	/// prefix: both <see cref="RuntimeRouteTemplate"/> (what ASP.NET routes on) and
	/// <see cref="GreetingModulePath"/> (what the browser requests) are built from it, so the
	/// route and the URL advertised in the package manifest cannot drift apart.
	/// </summary>
	private const string RoutePrefix = "/umbraco/le-løgin/api/v";

	/// <summary>
	/// Route template for the public (pre-auth) runtime controller. ASP.NET substitutes the
	/// version token; for version <see cref="LeLøginScreenApiVersion"/> it renders as
	/// <c>v{Major}</c>, which is what <see cref="GreetingModulePath"/> assumes.
	/// </summary>
	public const string RuntimeRouteTemplate = $"{RoutePrefix}{{version:apiVersion}}/";

	/// <summary>
	/// Route of the greeting ES module, relative to <see cref="RuntimeRouteTemplate"/>.
	/// </summary>
	public const string GreetingModuleActionRoute = "runtime/greeting.js";

	/// <summary>
	/// Application-relative path of the greeting ES module, without any path base.
	///
	/// This resolves <see cref="RuntimeRouteTemplate"/>'s version token by hand because a
	/// Razor view is built outside the routing pipeline and cannot ask ASP.NET to generate the
	/// URL. The substitution assumption (version <c>{Major}.0</c> renders as
	/// <c>v{Major}</c>) is verified by request against a running site — see the greeting
	/// section of docs/umbraco-login-customisation.md. Re-verify it when bumping
	/// <see cref="Major"/> or <see cref="Minor"/>.
	///
	/// Deliberately private: every consumer is outside the routing pipeline and therefore has
	/// to apply the path base itself, so the only way to obtain this path is through
	/// <see cref="GetGreetingModuleUrl"/>.
	/// </summary>
	private const string GreetingModuleAppPath = $"{RoutePrefix}{Major}/{GreetingModuleActionRoute}";

	/// <summary>
	/// Absolute path of the greeting ES module for the current request, as the package-owned
	/// login Razor view supplies it to its bootstrap module.
	/// </summary>
	/// <param name="pathBase">
	/// <see cref="HttpRequest.PathBase"/> of the current request.
	/// Sites hosted under a virtual path need it; without it the browser requests the module
	/// from the wrong origin-relative path and the greeting silently falls back to Umbraco's
	/// default.
	/// </param>
	public static string GetGreetingModuleUrl(PathString pathBase) =>
		// PathString.ToString() yields the URI-escaped form, so the non-ASCII segment is emitted
		// as "le-l%C3%B8gin" rather than relying on the browser to encode it.
		pathBase.Add(GreetingModuleAppPath).ToString();
}
