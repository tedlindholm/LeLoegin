using System.Globalization;
using Microsoft.AspNetCore.Http;

namespace LeLøgin.Core.Runtime;

/// <summary>
/// Builds the <see cref="LoginRuntimeContext"/> for a request. Shared by every endpoint that
/// resolves the active login screen so they cannot disagree about the current context.
/// </summary>
public static class LoginRuntimeContextFactory
{
	/// <summary>
	/// Query key carrying the per-render token. The package's login shell puts the same value on
	/// the background, logo, and greeting URLs of one render.
	/// </summary>
	public const string RenderTokenQueryKey = "lr";

	/// <summary>
	/// Length of the fallback bucket, in seconds.
	///
	/// Umbraco's <c>umb-auth-view</c> — the logout and session-timeout screens — hardcodes its
	/// background and logo URLs with no query string, so no render token can be attached to them.
	/// Without a shared seed those requests each draw independently and a random rule can pair one
	/// asset's logo with another's image. Bucketing the fallback by time makes every request in the
	/// same window resolve the same asset instead.
	///
	/// Long enough that the few milliseconds between one screen's requests are never split across
	/// two buckets; short enough that a random rule still visibly rotates. A screen loading exactly
	/// across a boundary can still split, which is why the login shell supplies an explicit token.
	/// </summary>
	public const int BucketSeconds = 60;

	/// <summary>
	/// Builds the context for <paramref name="request"/>, honouring any render token it carries.
	/// </summary>
	public static LoginRuntimeContext Create(HttpRequest request, TimeProvider timeProvider)
	{
		ArgumentNullException.ThrowIfNull(request);

		var now = timeProvider.GetLocalNow();

		// An explicit token keeps per-render randomness where the shell can inject one; otherwise
		// fall back to the current bucket so independent requests for one screen still agree.
		var renderToken = int.TryParse(
			request.Query[RenderTokenQueryKey],
			NumberStyles.Integer,
			CultureInfo.InvariantCulture,
			out var parsed)
			? parsed
			: (int)(now.ToUnixTimeSeconds() / BucketSeconds);

		return new LoginRuntimeContext(
			now.DayOfWeek.ToString().ToLowerInvariant(),
			now.Month,
			renderToken);
	}
}
