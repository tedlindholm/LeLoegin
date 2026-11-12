using Microsoft.AspNetCore.Http;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Security headers for every response that streams a stored Le Løgin image. An SVG opened
/// directly in the browser is a document on the backoffice origin; the policy blocks script,
/// external loads and same-origin access, while inline styles still render. Shown as an
/// <c>&lt;img&gt;</c>, an SVG never runs script, so the policy changes nothing on the login page.
/// </summary>
public static class ImageResponseHeaders
{
	/// <summary>The content security policy applied to stored image responses.</summary>
	public const string ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

	/// <summary>Sets <c>X-Content-Type-Options</c> and <c>Content-Security-Policy</c> on <paramref name="response"/>.</summary>
	/// <param name="response">The response that will carry the image.</param>
	/// <exception cref="ArgumentNullException"><paramref name="response"/> is <see langword="null"/>.</exception>
	public static void Apply(HttpResponse response)
	{
		ArgumentNullException.ThrowIfNull(response);
		response.Headers.XContentTypeOptions = "nosniff";
		response.Headers.ContentSecurityPolicy = ContentSecurityPolicy;
	}
}
