using Microsoft.AspNetCore.Authorization;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Requirement asserting the current backoffice user must have a specific Le Løgin permission verb.
/// </summary>
public sealed class LeLøginPermissionRequirement(string permissionVerb) : IAuthorizationRequirement
{
	public string PermissionVerb { get; } = permissionVerb;
}
