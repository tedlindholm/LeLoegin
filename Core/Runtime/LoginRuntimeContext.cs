namespace LeLøgin.Core.Runtime;

/// <summary>
/// Context values available when resolving the active login screen at runtime.
/// </summary>
/// <param name="Weekday">Lower-case local weekday name, matched by weekday rules.</param>
/// <param name="Month">Local month number, matched by month rules.</param>
/// <param name="RenderToken">
/// Identifies one login page render. A single render resolves the active asset from three
/// independent requests — background image, logo, and greeting module — so a random rule has to
/// pick the same image for all three. When null, the choice falls back to
/// <see cref="ILeLøginRandom"/> and each request decides on its own.
/// </param>
public sealed record LoginRuntimeContext(
	string Weekday,
	int Month,
	int? RenderToken = null);
