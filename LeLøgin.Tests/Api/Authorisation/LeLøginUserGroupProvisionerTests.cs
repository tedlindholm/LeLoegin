using LeLøgin.Core.Api.Authorisation;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace LeLøgin.Tests.Api.Authorisation;

public sealed class LeLøginUserGroupProvisionerTests
{
	private static readonly IShortStringHelper ShortStringHelper =
		new DefaultShortStringHelper(new DefaultShortStringHelperConfig());

	[Fact]
	public async Task EnsureProvisionedAsync_Creates_Group_When_Group_Does_Not_Exist()
	{
		var store = new FakeLeLøginUserGroupStore();
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);

		await provisioner.EnsureProvisionedAsync();

		var createdGroup = Assert.Single(store.CreatedGroups);
		Assert.Equal(LeLøginUserGroupDefaults.GroupAlias, createdGroup.Alias);
		Assert.Equal(LeLøginUserGroupDefaults.GroupName, createdGroup.Name);
		Assert.Equal(LeLøginUserGroupDefaults.GroupDescription, createdGroup.Description);
		Assert.Contains(Constants.Applications.Settings, createdGroup.AllowedSections);
		Assert.Contains(LeLøginPermissionVerbs.Manage, createdGroup.Permissions);
	}

	[Fact]
	public async Task EnsureProvisionedAsync_Does_Not_Regrant_Removed_Access_Or_Reset_Existing_Group()
	{
		var existingGroup = new UserGroup(ShortStringHelper)
		{
			Alias = LeLøginUserGroupDefaults.GroupAlias,
			Name = "Custom Name"
		};

		var store = new FakeLeLøginUserGroupStore(existingGroup);
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);

		await provisioner.EnsureProvisionedAsync();

		Assert.Empty(store.CreatedGroups);
		Assert.Equal("Custom Name", existingGroup.Name);
		Assert.DoesNotContain(Constants.Applications.Settings, existingGroup.AllowedSections);
		Assert.DoesNotContain(LeLøginPermissionVerbs.Manage, existingGroup.Permissions);
	}

	[Fact]
	public async Task EnsureProvisionedAsync_Does_Not_Update_Group_When_Already_Configured()
	{
		var existingGroup = new UserGroup(ShortStringHelper)
		{
			Alias = LeLøginUserGroupDefaults.GroupAlias,
			Name = LeLøginUserGroupDefaults.GroupName,
			Description = LeLøginUserGroupDefaults.GroupDescription,
			Icon = LeLøginUserGroupDefaults.GroupIcon
		};

		existingGroup.AddAllowedSection(Constants.Applications.Settings);
		existingGroup.Permissions.Add(LeLøginPermissionVerbs.Manage);

		var store = new FakeLeLøginUserGroupStore(existingGroup);
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);

		await provisioner.EnsureProvisionedAsync();

		Assert.Empty(store.CreatedGroups);
	}

	[Fact]
	public async Task EnsureProvisionedAsync_Does_Not_Take_Over_Unrelated_Group_With_Same_Name()
	{
		var unrelatedGroup = new UserGroup(ShortStringHelper)
		{
			Alias = "legacy-identity",
			Name = LeLøginUserGroupDefaults.GroupName
		};

		var store = new FakeLeLøginUserGroupStore(unrelatedGroup);
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);

		await provisioner.EnsureProvisionedAsync();

		var createdGroup = Assert.Single(store.CreatedGroups);
		Assert.Equal(LeLøginUserGroupDefaults.GroupAlias, createdGroup.Alias);
		Assert.Equal("legacyIdentity", unrelatedGroup.Alias);
		Assert.DoesNotContain(LeLøginPermissionVerbs.Manage, unrelatedGroup.Permissions);
	}

	private sealed class FakeLeLøginUserGroupStore(IUserGroup? group = null) : ILeLøginUserGroupStore
	{
		private IUserGroup? _group = group;

		public List<IUserGroup> CreatedGroups { get; } = [];

		public Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default)
		{
			return Task.FromResult(_group is not null && _group.Alias == groupAlias ? _group : null);
		}

		public Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		{
			CreatedGroups.Add(group);
			_group = group;
			return Task.CompletedTask;
		}
	}
}