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
	/// <summary>Alias of the user group; the primary key used to find an existing group.</summary>
	public const string GroupAlias = "leløgin";

	/// <summary>Display name of the user group; used as a fallback lookup when no group has the alias.</summary>
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

	/// <summary>Gets a user group by exact (ordinal) name.</summary>
	/// <param name="groupName">The name to look up.</param>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>The first group with the name, or <see langword="null"/> when none matches.</returns>
	Task<IUserGroup?> GetByNameAsync(string groupName, CancellationToken cancellationToken = default);

	/// <summary>Persists a new user group.</summary>
	/// <param name="group">The group to create.</param>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>A task that completes when the group has been created.</returns>
	Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default);

	/// <summary>Persists changes to an existing user group.</summary>
	/// <param name="group">The group to update.</param>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>A task that completes when the group has been updated.</returns>
	Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default);
}

/// <summary>
/// Umbraco-backed implementation used to create and update the Le Løgin user group.
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
	public Task<IUserGroup?> GetByNameAsync(string groupName, CancellationToken cancellationToken = default)
		=> GetByNameInternalAsync(groupName);

	private async Task<IUserGroup?> GetByNameInternalAsync(string groupName)
	{
		var groups = await userGroupService.GetAllAsync(0, int.MaxValue);

		foreach (var group in groups.Items)
		{
			if (string.Equals(group.Name, groupName, StringComparison.Ordinal))
			{
				return group;
			}
		}

		return null;
	}

	/// <inheritdoc />
	public async Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		=> _ = await userGroupService.CreateAsync(group, Constants.Security.SuperUserKey, null);

	/// <inheritdoc />
	public async Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		=> _ = await userGroupService.UpdateAsync(group, Constants.Security.SuperUserKey);
}

/// <summary>
/// Ensures the package-managed Le Løgin backoffice user group exists and has the required access.
/// </summary>
/// <param name="store">Reads and writes the user group.</param>
/// <param name="shortStringHelper">Required by Umbraco to construct a new <see cref="UserGroup"/>.</param>
public sealed class LeLøginUserGroupProvisioner(
	ILeLøginUserGroupStore store,
	IShortStringHelper shortStringHelper)
{
	/// <summary>
	/// Finds the group by alias, then by name, and creates it when neither exists. An existing group
	/// has its alias, name, description and icon reset to the defaults and gains Settings section
	/// access and the manage permission; it is saved only when something changed. Other sections,
	/// permissions and members are left as they are.
	/// </summary>
	/// <param name="cancellationToken">Cancels the operation.</param>
	/// <returns>A task that completes when the group is provisioned.</returns>
	public async Task EnsureProvisionedAsync(CancellationToken cancellationToken = default)
	{
		var existingGroup = await store.GetAsync(LeLøginUserGroupDefaults.GroupAlias, cancellationToken)
			?? await store.GetByNameAsync(LeLøginUserGroupDefaults.GroupName, cancellationToken);

		if (existingGroup is null)
		{
			var newGroup = CreateGroup();
			await store.CreateAsync(newGroup, cancellationToken);
			return;
		}

		if (ApplyRequiredConfiguration(existingGroup))
		{
			await store.UpdateAsync(existingGroup, cancellationToken);
		}
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

		ApplyRequiredConfiguration(group);
		return group;
	}

	private static bool ApplyRequiredConfiguration(IUserGroup group)
	{
		var changed = false;

		if (!string.Equals(group.Alias, LeLøginUserGroupDefaults.GroupAlias, StringComparison.Ordinal))
		{
			group.Alias = LeLøginUserGroupDefaults.GroupAlias;
			changed = true;
		}

		if (!string.Equals(group.Name, LeLøginUserGroupDefaults.GroupName, StringComparison.Ordinal))
		{
			group.Name = LeLøginUserGroupDefaults.GroupName;
			changed = true;
		}

		if (!string.Equals(group.Description, LeLøginUserGroupDefaults.GroupDescription, StringComparison.Ordinal))
		{
			group.Description = LeLøginUserGroupDefaults.GroupDescription;
			changed = true;
		}

		if (!string.Equals(group.Icon, LeLøginUserGroupDefaults.GroupIcon, StringComparison.Ordinal))
		{
			group.Icon = LeLøginUserGroupDefaults.GroupIcon;
			changed = true;
		}

		if (!group.AllowedSections.Contains(Constants.Applications.Settings, StringComparer.Ordinal))
		{
			group.AddAllowedSection(Constants.Applications.Settings);
			changed = true;
		}

		if (!group.Permissions.Contains(LeLøginPermissionVerbs.Manage, StringComparer.Ordinal))
		{
			group.Permissions.Add(LeLøginPermissionVerbs.Manage);
			changed = true;
		}

		return changed;
	}
}

/// <summary>
/// Provisions the Le Løgin backoffice user group when Umbraco has fully started.
/// Does nothing unless the runtime level is <see cref="RuntimeLevel.Run"/>, so installs and upgrades are skipped.
/// </summary>
/// <param name="provisioner">Creates or updates the user group.</param>
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
