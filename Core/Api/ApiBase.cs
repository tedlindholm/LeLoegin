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
	/// Absolute path of the greeting ES module as the browser requests it — the value the
	/// package manifest advertises as the localisation extensions' <c>js</c> loader.
	///
	/// This resolves <see cref="RuntimeRouteTemplate"/>'s version token by hand because a
	/// package manifest is built outside the routing pipeline and cannot ask ASP.NET to
	/// generate the URL. The substitution assumption (version <c>{Major}.0</c> renders as
	/// <c>v{Major}</c>) is verified by request against a running site — see the greeting
	/// section of docs/umbraco-login-customisation.md. Re-verify it when bumping
	/// <see cref="Major"/> or <see cref="Minor"/>.
	/// </summary>
	public const string GreetingModulePath = $"{RoutePrefix}{Major}/{GreetingModuleActionRoute}";
}
