export const LOGIN_SCREEN_PERMISSION_ENTITY_TYPE = 'login-screen';
export const LOGIN_SCREEN_MANAGE_PERMISSION_ALIAS = 'LeLøgin.Permission.Manage';
export const LOGIN_SCREEN_MANAGE_PERMISSION_VERB = 'LeLøgin.Manage';

/**
 * Creates a permission condition for the login screen manage permission.
 * Used to gate UI elements and actions to users with proper permissions.
 *
 * @returns A condition object that checks for the manage permission
 *
 * @example
 * ```typescript
 * const condition = createLeLøginScreenManagePermissionCondition();
 * // Use in manifest conditions array
 * ```
 */
export const createLeLøginScreenManagePermissionCondition = () => ({
	alias: 'Umb.Condition.UserPermission.Fallback',
	oneOf: [LOGIN_SCREEN_MANAGE_PERMISSION_VERB]
});
