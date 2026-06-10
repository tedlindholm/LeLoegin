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
	public async Task EnsureProvisionedAsync_Updates_Group_When_Required_Access_Is_Missing()
	{
		var existingGroup = new UserGroup(ShortStringHelper)
		{
			Alias = LeLøginUserGroupDefaults.GroupAlias,
			Name = "Temporary Name"
		};

		var store = new FakeLeLøginUserGroupStore(existingGroup);
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);

		await provisioner.EnsureProvisionedAsync();

		var updatedGroup = Assert.Single(store.UpdatedGroups);
		Assert.Equal(LeLøginUserGroupDefaults.GroupName, updatedGroup.Name);
		Assert.Equal(LeLøginUserGroupDefaults.GroupDescription, updatedGroup.Description);
		Assert.Contains(Constants.Applications.Settings, updatedGroup.AllowedSections);
		Assert.Contains(LeLøginPermissionVerbs.Manage, updatedGroup.Permissions);
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
		Assert.Empty(store.UpdatedGroups);
	}

	[Fact]
	public async Task EnsureProvisionedAsync_Updates_Group_When_Group_Exists_With_Legacy_Alias()
	{
		var existingGroup = new UserGroup(ShortStringHelper)
		{
			Alias = "legacy-identity",
			Name = LeLøginUserGroupDefaults.GroupName
		};

		var store = new FakeLeLøginUserGroupStore(existingGroup);
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);

		await provisioner.EnsureProvisionedAsync();

		Assert.Empty(store.CreatedGroups);
		var updatedGroup = Assert.Single(store.UpdatedGroups);
		Assert.Equal(LeLøginUserGroupDefaults.GroupAlias, updatedGroup.Alias);
		Assert.Equal(LeLøginUserGroupDefaults.GroupDescription, updatedGroup.Description);
		Assert.Contains(Constants.Applications.Settings, updatedGroup.AllowedSections);
		Assert.Contains(LeLøginPermissionVerbs.Manage, updatedGroup.Permissions);
	}

	private sealed class FakeLeLøginUserGroupStore(IUserGroup? group = null) : ILeLøginUserGroupStore
	{
		private IUserGroup? _group = group;

        public List<IUserGroup> CreatedGroups { get; } = [];

		public List<IUserGroup> UpdatedGroups { get; } = [];

		public Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default)
		{
			return Task.FromResult(_group is not null && _group.Alias == groupAlias ? _group : null);
		}

		public Task<IUserGroup?> GetByNameAsync(string groupName, CancellationToken cancellationToken = default)
		{
			return Task.FromResult(_group is not null && _group.Name == groupName ? _group : null);
		}

		public Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		{
			CreatedGroups.Add(group);
			_group = group;
			return Task.CompletedTask;
		}

		public Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		{
			UpdatedGroups.Add(group);
			_group = group;
			return Task.CompletedTask;
		}
	}
}