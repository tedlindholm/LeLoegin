namespace LeLøgin.Core.Runtime;

/// <summary>
/// Context values available when resolving the active login screen at runtime.
/// </summary>
/// <param name="Weekday">Lower-case local weekday name, matched by weekday rules.</param>
/// <param name="Month">Local month number, matched by month rules.</param>
/// <param name="RenderToken">
/// Seed deciding which image a multi-image rule resolves to. A single screen resolves the active
/// asset from up to three independent requests — background, logo, and greeting — so they must
/// share this value or they disagree. Built by <see cref="LoginRuntimeContextFactory"/>: the
/// login shell's explicit token when present, otherwise the current time bucket.
/// </param>
public sealed record LoginRuntimeContext(
	string Weekday,
	int Month,
	int RenderToken);
