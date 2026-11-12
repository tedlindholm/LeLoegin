/** Entity type the Le Løgin permission is registered for. */
export const LOGIN_SCREEN_PERMISSION_ENTITY_TYPE = 'login-screen';
/** Manifest alias of the Le Løgin manage permission. */
export const LOGIN_SCREEN_MANAGE_PERMISSION_ALIAS = 'LeLøgin.Permission.Manage';
/** Permission verb granted to users who may manage Le Løgin; checked by every gated manifest. */
export const LOGIN_SCREEN_MANAGE_PERMISSION_VERB = 'LeLøgin.Manage';

/**
 * Creates a manifest condition that passes only for users holding the Le Løgin manage verb.
 * Gates every Le Løgin menu, tree, repository and action.
 *
 * @returns A fresh `Umb.Condition.UserPermission.Fallback` condition for the manage verb.
 */
export const createLeLøginScreenManagePermissionCondition = () => ({
	alias: 'Umb.Condition.UserPermission.Fallback',
	oneOf: [LOGIN_SCREEN_MANAGE_PERMISSION_VERB]
});
