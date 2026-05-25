using Umbraco.Cms.Core.Models.Membership;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Evaluates whether a backoffice user has the required Le Løgin permission.
/// </summary>
public static class LeLøginPermissionEvaluator
{
	public static bool UserHasPermission(IUser? user, string permissionVerb)
	{
		if (user is null || string.IsNullOrWhiteSpace(permissionVerb))
		{
			return false;
		}

		return user.Groups.Any(group =>
			group.Permissions.Contains(permissionVerb, StringComparer.Ordinal));
	}
}
