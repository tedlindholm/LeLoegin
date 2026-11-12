using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Strings;

namespace LeLøgin.Core.Api.Authorisation;

/// <summary>
/// Default values for the package-managed Le Løgin backoffice user group.
/// </summary>
public static class LeLøginUserGroupDefaults
{
	/// <summary>Alias of the user group; matches Umbraco's safe-alias normalisation (<c>ø</c> → <c>oe</c>) so lookups by alias succeed.</summary>
	public const string GroupAlias = "leloegin";

	/// <summary>Display name of the user group.</summary>
	public const string GroupName = "Le Løgin";

	/// <summary>Description shown on the user group.</summary>
	public const string GroupDescription = "Access to Le Løgin settings and asset management.";

	/// <summary>Backoffice icon of the user group.</summary>
	public const string GroupIcon = "icon-lock";
}

/// <summary>
/// Minimal abstraction over Umbraco's user-group service for Le Løgin provisioning.
/// </summary>
public interface ILeLøginUserGroupStore
{
	/// <summary>Gets a user group by alias.</summary>
	/// <param name="groupAlias">The alias to look up.</param>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>The group, or <see langword="null"/> when none has the alias.</returns>
	Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default);

	/// <summary>Persists a new user group.</summary>
	/// <param name="group">The group to create.</param>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>A task that completes when the group has been created.</returns>
	Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default);
}

/// <summary>
/// Umbraco-backed implementation used to create the Le Løgin user group.
/// Writes are performed as the Umbraco super user. The cancellation token is not forwarded
/// because <see cref="IUserGroupService"/> does not accept one.
/// </summary>
/// <param name="userGroupService">Umbraco's user-group service.</param>
public sealed class UmbracoLeLøginUserGroupStore(IUserGroupService userGroupService) : ILeLøginUserGroupStore
{
	/// <inheritdoc />
	public async Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default)
		=> await userGroupService.GetAsync(groupAlias);

	/// <inheritdoc />
	public async Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		=> _ = await userGroupService.CreateAsync(group, Constants.Security.SuperUserKey, null);
}

/// <summary>
/// Ensures the package-managed Le Løgin backoffice user group is created once when missing.
/// </summary>
/// <param name="store">Reads and writes the user group.</param>
/// <param name="shortStringHelper">Required by Umbraco to construct a new <see cref="UserGroup"/>.</param>
public sealed class LeLøginUserGroupProvisioner(
	ILeLøginUserGroupStore store,
	IShortStringHelper shortStringHelper)
{
	/// <summary>
	/// Finds the group by alias and creates it once when it does not exist. An existing group is
	/// left untouched so administrator changes to its name, description, icon, sections or
	/// permissions are preserved across restarts, and unrelated groups with the same display name
	/// are never taken over.
	/// </summary>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>A task that completes when the group is provisioned.</returns>
	public async Task EnsureProvisionedAsync(CancellationToken cancellationToken = default)
	{
		var existingGroup = await store.GetAsync(LeLøginUserGroupDefaults.GroupAlias, cancellationToken);

		if (existingGroup is not null)
		{
			return;
		}

		var newGroup = CreateGroup();
		await store.CreateAsync(newGroup, cancellationToken);
	}

	private UserGroup CreateGroup()
	{
		var group = new UserGroup(shortStringHelper)
		{
			Alias = LeLøginUserGroupDefaults.GroupAlias,
			Name = LeLøginUserGroupDefaults.GroupName,
			Description = LeLøginUserGroupDefaults.GroupDescription,
			Icon = LeLøginUserGroupDefaults.GroupIcon
		};

		group.AddAllowedSection(Constants.Applications.Settings);
		group.Permissions.Add(LeLøginPermissionVerbs.Manage);
		return group;
	}
}

/// <summary>
/// Provisions the Le Løgin backoffice user group when Umbraco has fully started.
/// Does nothing unless the runtime level is <see cref="RuntimeLevel.Run"/>, so installs and upgrades are skipped.
/// </summary>
/// <param name="provisioner">Creates the user group when missing.</param>
/// <param name="runtimeState">Reports the current runtime level.</param>
public sealed class LeLøginUserGroupProvisioningNotificationHandler(
	LeLøginUserGroupProvisioner provisioner,
	IRuntimeState runtimeState)
	: INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
	/// <inheritdoc />
	public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
	{
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			return;
		}

		await provisioner.EnsureProvisionedAsync(cancellationToken);
	}
}
