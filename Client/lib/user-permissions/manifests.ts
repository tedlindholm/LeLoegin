import type { ManifestEntityUserPermission } from '@umbraco-cms/backoffice/user-permission';
import {
	LOGIN_SCREEN_MANAGE_PERMISSION_ALIAS,
	LOGIN_SCREEN_MANAGE_PERMISSION_VERB,
	LOGIN_SCREEN_PERMISSION_ENTITY_TYPE
} from './constants.js';

const manageLeLøginScreenPermissionManifest = {
	type: 'entityUserPermission',
	alias: LOGIN_SCREEN_MANAGE_PERMISSION_ALIAS,
	name: 'Manage Le Løgin User Permission',
	forEntityTypes: [LOGIN_SCREEN_PERMISSION_ENTITY_TYPE],
	meta: {
		verbs: [LOGIN_SCREEN_MANAGE_PERMISSION_VERB],
		label: '#loginScreen_permissionManageLabel',
		description: '#loginScreen_permissionManageDescription',
		group: 'general'
	}
} satisfies ManifestEntityUserPermission;

export const manifests = [
	manageLeLøginScreenPermissionManifest
] satisfies ReadonlyArray<ManifestEntityUserPermission>;
