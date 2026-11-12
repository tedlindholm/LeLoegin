using Microsoft.AspNetCore.Authorization;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Requirement asserting the current backoffice user must have a specific Le Løgin permission verb.
/// </summary>
/// <param name="permissionVerb">The permission verb the user must hold through one of their user groups.</param>
public sealed class LeLøginPermissionRequirement(string permissionVerb) : IAuthorizationRequirement
{
	/// <summary>The permission verb the user must hold through one of their user groups.</summary>
	public string PermissionVerb { get; } = permissionVerb;
}
