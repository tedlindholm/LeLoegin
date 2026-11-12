using Umbraco.Cms.Core.Models.Membership;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Evaluates whether a backoffice user has the required Le Løgin permission.
/// </summary>
public static class LeLøginPermissionEvaluator
{
	/// <summary>
	/// Checks whether any of the user's groups grants <paramref name="permissionVerb"/> (ordinal comparison).
	/// </summary>
	/// <param name="user">The backoffice user, or <see langword="null"/> when there is none.</param>
	/// <param name="permissionVerb">The permission verb to look for.</param>
	/// <returns><see langword="true"/> when the user holds the verb; <see langword="false"/> when the user is null, the verb is blank or no group grants it.</returns>
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
