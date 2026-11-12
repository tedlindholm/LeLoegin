using LeLøgin.Core.Runtime;
using LeLøgin.Core.Storage;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Services;

namespace LeLøgin.Core.Api.Runtime;

/// <summary>
/// Public, read-only endpoint that serves the greeting localisation ES module for the login page.
/// Resolves per request and responds with <c>Cache-Control: no-store</c>.
/// </summary>
/// <param name="store">Reads assets and rules.</param>
/// <param name="runtimeResolver">Picks the background asset that applies to the request.</param>
/// <param name="timeProvider">Supplies the current time for weekday and month conditions.</param>
/// <param name="runtimeState">Reports whether Umbraco is fully running; otherwise the endpoint returns an empty module.</param>
public class RuntimeController(
	ILeLøginScreenStore store,
	LeLøginScreenRuntimeResolver runtimeResolver,
	TimeProvider timeProvider,
	IRuntimeState runtimeState) : RuntimeControllerBase
{
	/// <summary>
	/// Serves the greeting localisation as an ES module, consumed by the package-owned login
	/// bootstrap before it imports Umbraco's login bundle.
	/// Resolved per request with <c>Cache-Control: no-store</c> so asset swaps, weekday/month
	/// rule flips, and random rules apply on the next login-page load on every instance —
	/// the same freshness model as the background-image middleware. Only the <c>login</c>
	/// namespace is emitted: in Umbraco 18 both the login page and the logout view read
	/// <c>login_greeting0..6</c>, and <c>auth_greeting*</c> is deprecated for removal in 20.
	/// </summary>
	/// <returns>
	/// A <c>text/javascript</c> module whose default export overrides every weekday greeting, or an
	/// empty object when no greeting applies or Umbraco is not running.
	/// </returns>
	[HttpGet(ApiBase.GreetingModuleActionRoute)]
	// An ES module resource, not part of the JSON API contract — keep it out of the OpenAPI
	// document so the generated client stays stable.
	[ApiExplorerSettings(IgnoreApi = true)]
	public async Task<IActionResult> GreetingModule()
	{
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			Response.Headers.CacheControl = "no-store";
			return Content("export default {};", "text/javascript; charset=utf-8");
		}

		var (asset, _) = await ActiveBackgroundResolver.ResolveAsync(
			store,
			runtimeResolver,
			Request,
			timeProvider);

		var greeting = asset?.GreetingText;
		object payload;
		if (string.IsNullOrWhiteSpace(greeting))
		{
			// An empty default export merges nothing; Umbraco's core greetings show as normal.
			payload = new { };
		}
		else
		{
			var greetingValues = new Dictionary<string, string>(StringComparer.Ordinal);
			for (var day = 0; day < 7; day++)
			{
				greetingValues[$"greeting{day}"] = greeting;
			}

			payload = new { login = greetingValues };
		}

		// System.Text.Json's default encoder escapes quotes and non-ASCII, so the serialised
		// object is always a single well-formed JS literal regardless of the greeting text.
		var module = $"export default {System.Text.Json.JsonSerializer.Serialize(payload)};";

		Response.Headers.CacheControl = "no-store";
		return Content(module, "text/javascript; charset=utf-8");
	}
}
