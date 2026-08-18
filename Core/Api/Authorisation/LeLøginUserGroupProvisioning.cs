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
	public const string GroupAlias = "leløgin";

	public const string GroupName = "Le Løgin";

	public const string GroupDescription = "Access to Le Løgin settings and asset management.";

	public const string GroupIcon = "icon-lock";
}

/// <summary>
/// Minimal abstraction over Umbraco's user-group service for Le Løgin provisioning.
/// </summary>
public interface ILeLøginUserGroupStore
{
	Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default);

	Task<IUserGroup?> GetByNameAsync(string groupName, CancellationToken cancellationToken = default);

	Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default);

	Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default);
}

/// <summary>
/// Umbraco-backed implementation used to create and update the Le Løgin user group.
/// </summary>
public sealed class UmbracoLeLøginUserGroupStore(IUserGroupService userGroupService) : ILeLøginUserGroupStore
{
	public async Task<IUserGroup?> GetAsync(string groupAlias, CancellationToken cancellationToken = default)
		=> await userGroupService.GetAsync(groupAlias);

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

	public async Task CreateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		=> _ = await userGroupService.CreateAsync(group, Constants.Security.SuperUserKey, null);

	public async Task UpdateAsync(IUserGroup group, CancellationToken cancellationToken = default)
		=> _ = await userGroupService.UpdateAsync(group, Constants.Security.SuperUserKey);
}

/// <summary>
/// Ensures the package-managed Le Løgin backoffice user group exists and has the required access.
/// </summary>
public sealed class LeLøginUserGroupProvisioner(
	ILeLøginUserGroupStore store,
	IShortStringHelper shortStringHelper)
{
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
/// </summary>
public sealed class LeLøginUserGroupProvisioningNotificationHandler(
	LeLøginUserGroupProvisioner provisioner,
	IRuntimeState runtimeState)
	: INotificationAsyncHandler<UmbracoApplicationStartedNotification>
{
	public async Task HandleAsync(UmbracoApplicationStartedNotification notification, CancellationToken cancellationToken)
	{
		if (runtimeState.Level != RuntimeLevel.Run)
		{
			return;
		}

		await provisioner.EnsureProvisionedAsync(cancellationToken);
	}
}
