namespace LeLøgin.Core.Runtime;

/// <summary>
/// Context values available when resolving the active login screen at runtime.
/// </summary>
public sealed record LoginRuntimeContext(
	string Weekday,
	int Month,
	string Date,
	string Hostname);