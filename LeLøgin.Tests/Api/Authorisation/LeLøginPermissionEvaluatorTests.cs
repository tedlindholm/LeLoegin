using LeLøgin.Core.Api.Authorisation;
using Umbraco.Cms.Core.Configuration.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Security;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace LeLøgin.Tests.Api.Authorisation;

public sealed class LeLøginPermissionEvaluatorTests
{
	private static readonly GlobalSettings GlobalSettings = new();
	private static readonly IShortStringHelper ShortStringHelper =
		new DefaultShortStringHelper(new DefaultShortStringHelperConfig());

	[Fact]
	public void UserHasPermission_Returns_True_When_Group_Contains_Permission()
	{
		var user = CreateUserWithPermissions(LeLøginPermissionVerbs.Manage);

		var hasPermission = LeLøginPermissionEvaluator.UserHasPermission(user, LeLøginPermissionVerbs.Manage);

		Assert.True(hasPermission);
	}

	[Fact]
	public void UserHasPermission_Returns_False_When_Group_Does_Not_Contain_Permission()
	{
		var user = CreateUserWithPermissions("Some.Other.Permission");

		var hasPermission = LeLøginPermissionEvaluator.UserHasPermission(user, LeLøginPermissionVerbs.Manage);

		Assert.False(hasPermission);
	}

	[Fact]
	public void UserHasPermission_Returns_False_When_User_Is_Null()
	{
		var hasPermission = LeLøginPermissionEvaluator.UserHasPermission(null, LeLøginPermissionVerbs.Manage);

		Assert.False(hasPermission);
	}

	private static User CreateUserWithPermissions(params string[] permissions)
	{
		var group = new UserGroup(ShortStringHelper)
		{
			Alias = "leløgin-test-group",
			Name = "Le Løgin Test Group",
			Icon = "icon-lock"
		};

		foreach (var permission in permissions)
		{
			group.Permissions.Add(permission);
		}

		var user = new User(
			GlobalSettings,
			name: "Le Løgin Test User",
			email: "leløgin-test@example.com",
			username: "leløgin-test-user",
			rawPasswordValue: "not-used-in-tests");

		user.AddGroup(group);
		return user;
	}
}
