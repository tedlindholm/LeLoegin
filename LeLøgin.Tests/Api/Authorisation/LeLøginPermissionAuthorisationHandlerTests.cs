using System.Security.Claims;
using LeLøgin.Core.Api.Authorisation;
using Microsoft.AspNetCore.Authorization;
using Moq;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Security;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace LeLøgin.Tests.Api.Authorisation;

/// <summary>Checks permission requirements through public authorisation handling.</summary>
public sealed class LeLøginPermissionAuthorisationHandlerTests
{
	[Theory]
	[InlineData(LeLøginPermissionVerbs.Manage)]
	[InlineData("Custom.Permission")]
	public async Task HandleAsync_Succeeds_When_Any_Current_User_Group_Grants_The_Requested_Permission(string permission)
	{
		var user = CreateUser(["Other.Permission"], [permission]);
		var requirement = new LeLøginPermissionRequirement(permission);
		var context = CreateContext(requirement);
		var handler = CreateHandler(user);

		await handler.HandleAsync(context);

		Assert.True(context.HasSucceeded);
		Assert.Empty(context.PendingRequirements);
	}

	[Theory]
	[InlineData("Other.Permission")]
	[InlineData("leløgin.manage")]
	[InlineData("LeLøgin.Manage ")]
	public async Task HandleAsync_Leaves_The_Requirement_Unmet_When_No_Group_Grants_The_Exact_Permission(string grantedPermission)
	{
		var requirement = new LeLøginPermissionRequirement(LeLøginPermissionVerbs.Manage);
		var context = CreateContext(requirement);
		var handler = CreateHandler(CreateUser([grantedPermission]));

		await handler.HandleAsync(context);

		Assert.False(context.HasSucceeded);
		Assert.Contains(requirement, context.PendingRequirements);
	}

	[Fact]
	public async Task HandleAsync_Leaves_The_Requirement_Unmet_When_The_User_Has_No_Groups()
	{
		var requirement = new LeLøginPermissionRequirement(LeLøginPermissionVerbs.Manage);
		var context = CreateContext(requirement);
		var handler = CreateHandler(CreateUser());

		await handler.HandleAsync(context);

		Assert.False(context.HasSucceeded);
		Assert.Contains(requirement, context.PendingRequirements);
	}

	[Theory]
	[InlineData("")]
	[InlineData(" ")]
	public async Task HandleAsync_Leaves_Blank_Permission_Requirements_Unmet(string permission)
	{
		var requirement = new LeLøginPermissionRequirement(permission);
		var context = CreateContext(requirement);
		var handler = CreateHandler(CreateUser([permission]));

		await handler.HandleAsync(context);

		Assert.False(context.HasSucceeded);
		Assert.Contains(requirement, context.PendingRequirements);
	}

	[Theory]
	[InlineData(false)]
	[InlineData(true)]
	public async Task HandleAsync_Leaves_The_Requirement_Unmet_When_Security_Or_The_Current_User_Is_Missing(bool securityAvailable)
	{
		var security = new Mock<IBackOfficeSecurity>();
		security.SetupGet(value => value.CurrentUser).Returns((IUser?)null);
		var accessor = new Mock<IBackOfficeSecurityAccessor>();
		accessor.SetupGet(value => value.BackOfficeSecurity).Returns(securityAvailable ? security.Object : null);
		var handler = new LeLøginPermissionAuthorisationHandler(accessor.Object);
		var requirement = new LeLøginPermissionRequirement(LeLøginPermissionVerbs.Manage);
		var context = CreateContext(requirement);

		await handler.HandleAsync(context);

		Assert.False(context.HasSucceeded);
		Assert.Contains(requirement, context.PendingRequirements);
	}

	[Fact]
	public async Task HandleAsync_Does_Not_Satisfy_Another_Requirement_When_Only_Manage_Is_Granted()
	{
		var manage = new LeLøginPermissionRequirement(LeLøginPermissionVerbs.Manage);
		var other = new LeLøginPermissionRequirement("Other.Permission");
		var context = new AuthorizationHandlerContext([manage, other], new ClaimsPrincipal(), resource: null);
		var handler = CreateHandler(CreateUser([LeLøginPermissionVerbs.Manage]));

		await handler.HandleAsync(context);

		Assert.False(context.HasSucceeded);
		Assert.Equal(other, Assert.Single(context.PendingRequirements));
	}

	private static AuthorizationHandlerContext CreateContext(LeLøginPermissionRequirement requirement) =>
		new([requirement], new ClaimsPrincipal(), resource: null);

	private static LeLøginPermissionAuthorisationHandler CreateHandler(IUser user)
	{
		var security = new Mock<IBackOfficeSecurity>();
		security.SetupGet(value => value.CurrentUser).Returns(user);
		var accessor = new Mock<IBackOfficeSecurityAccessor>();
		accessor.SetupGet(value => value.BackOfficeSecurity).Returns(security.Object);
		return new LeLøginPermissionAuthorisationHandler(accessor.Object);
	}

	private static User CreateUser(params string[][] permissionsByGroup)
	{
		var user = new User(new GlobalSettings(), "Permission test user", "permissions@example.com", "permissions", "unused");
		var strings = new DefaultShortStringHelper(new DefaultShortStringHelperConfig());
		for (var index = 0; index < permissionsByGroup.Length; index++)
		{
			var group = new UserGroup(strings)
			{
				Alias = $"permission-test-{index}", Name = $"Permission test {index}", Icon = "icon-lock"
			};
			foreach (var permission in permissionsByGroup[index]) group.Permissions.Add(permission);
			user.AddGroup(group);
		}
		return user;
	}
}
