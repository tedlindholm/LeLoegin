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
	/// Builds the context for <paramref name="request"/>, honouring any render token it carries.
	/// </summary>
	public static LoginRuntimeContext Create(HttpRequest request, TimeProvider timeProvider)
	{
		ArgumentNullException.ThrowIfNull(request);

		var renderToken = int.TryParse(
			request.Query[RenderTokenQueryKey],
			NumberStyles.Integer,
			CultureInfo.InvariantCulture,
			out var parsed)
			? parsed
			: (int?)null;

		var now = timeProvider.GetLocalNow();
		return new LoginRuntimeContext(
			now.DayOfWeek.ToString().ToLowerInvariant(),
			now.Month,
			renderToken);
	}
}
