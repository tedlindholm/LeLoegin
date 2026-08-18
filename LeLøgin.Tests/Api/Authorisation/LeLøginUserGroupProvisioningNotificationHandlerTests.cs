using LeLøgin.Core.Api.Authorisation;
using Moq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace LeLøgin.Tests.Api.Authorisation;

public sealed class LeLøginUserGroupProvisioningNotificationHandlerTests
{
	private static readonly IShortStringHelper ShortStringHelper =
		new DefaultShortStringHelper(new DefaultShortStringHelperConfig());

	[Fact]
	public async Task HandleAsync_Completes_Without_User_Group_Access_During_Installation()
	{
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(RuntimeLevel.Install);
		var provisioner = new LeLøginUserGroupProvisioner(
			new UnavailableUserGroupStore(),
			ShortStringHelper);
		var handler = new LeLøginUserGroupProvisioningNotificationHandler(
			provisioner,
			runtimeState.Object);

		await handler.HandleAsync(
			new UmbracoApplicationStartedNotification(isRestarting: false),
			CancellationToken.None);
	}

	[Fact]
	public async Task HandleAsync_Provisions_The_User_Group_When_Umbraco_Is_Running()
	{
		var runtimeState = new Mock<IRuntimeState>();
		runtimeState.SetupGet(state => state.Level).Returns(RuntimeLevel.Run);
		var store = new RecordingUserGroupStore();
		var provisioner = new LeLøginUserGroupProvisioner(store, ShortStringHelper);
		var handler = new LeLøginUserGroupProvisioningNotificationHandler(
			provisioner,
			runtimeState.Object);

		await handler.HandleAsync(
			new UmbracoApplicationStartedNotification(isRestarting: false),
			CancellationToken.None);

		var createdGroup = Assert.Single(store.CreatedGroups);
		Assert.Equal(LeLøginUserGroupDefaults.GroupAlias, createdGroup.Alias);
	}

	private sealed class UnavailableUserGroupStore : ILeLøginUserGroupStore
	{
		public Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default)
			=> throw new InvalidOperationException("The user-group database is unavailable during installation.");

		public Task<IUserGroup?> GetByNameAsync(string groupName, CancellationToken cancellationToken = default)
			=> throw new InvalidOperationException("The user-group database is unavailable during installation.");

		public Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
			=> throw new InvalidOperationException("The user-group database is unavailable during installation.");

		public Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default)
			=> throw new InvalidOperationException("The user-group database is unavailable during installation.");
	}

	private sealed class RecordingUserGroupStore : ILeLøginUserGroupStore
	{
		public List<IUserGroup> CreatedGroups { get; } = [];

		public Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default)
			=> Task.FromResult<IUserGroup?>(null);

		public Task<IUserGroup?> GetByNameAsync(string groupName, CancellationToken cancellationToken = default)
			=> Task.FromResult<IUserGroup?>(null);

		public Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		{
			CreatedGroups.Add(group);
			return Task.CompletedTask;
		}

		public Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default)
			=> throw new InvalidOperationException("A newly provisioned group must not be updated.");
	}
}
