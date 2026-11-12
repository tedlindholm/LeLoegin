namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Le Løgin permission constants and authorisation policy names.
/// </summary>
public static class LeLøginAuthorisationPolicies
{
	/// <summary>Policy name requiring the <see cref="LeLøginPermissionVerbs.Manage"/> permission; applied to every management endpoint.</summary>
	public const string ManageLeLøgin = "LeLøgin.Policy.Manage";
}
