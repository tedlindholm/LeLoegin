using Microsoft.AspNetCore.Authorization;
using Umbraco.Cms.Core.Security;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Authorisation handler for Le Løgin permission requirements.
/// </summary>
public sealed class LeLøginPermissionAuthorisationHandler(
	IBackOfficeSecurityAccessor backOfficeSecurityAccessor)
	: AuthorizationHandler<LeLøginPermissionRequirement>
{
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
