using Microsoft.AspNetCore.Authorization;
using Umbraco.Cms.Core.Security;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Authorisation handler for Le Løgin permission requirements.
/// Succeeds when the current backoffice user holds the required verb; otherwise leaves the
/// requirement unmet so authorisation fails.
/// </summary>
/// <param name="backOfficeSecurityAccessor">Provides the current backoffice user.</param>
public sealed class LeLøginPermissionAuthorisationHandler(
	IBackOfficeSecurityAccessor backOfficeSecurityAccessor)
	: AuthorizationHandler<LeLøginPermissionRequirement>
{
	/// <inheritdoc />
	protected override Task HandleRequirementAsync(
		AuthorizationHandlerContext context,
		LeLøginPermissionRequirement requirement)
	{
		var currentUser = backOfficeSecurityAccessor.BackOfficeSecurity?.CurrentUser;

		if (LeLøginPermissionEvaluator.UserHasPermission(currentUser, requirement.PermissionVerb))
		{
			context.Succeed(requirement);
		}

		return Task.CompletedTask;
	}
}
