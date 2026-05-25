import {
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
} from '../types.js';
import { createLeLøginScreenManagePermissionCondition } from '../../user-permissions/constants.js';

const ASSET_REPOSITORY_ALIAS = 'LeLøgin.Repository.Asset';
const manageLeLøginScreenCondition = createLeLøginScreenManagePermissionCondition();

const assetRepositoryManifest: UmbExtensionManifest = {
	type: 'repository',
	alias: ASSET_REPOSITORY_ALIAS,
	name: 'Login Screen Asset Repository',
	api: () => import('../../assets/asset.repository.js'),
	conditions: [manageLeLøginScreenCondition],
};

// Welcome images group — single option navigates directly to the background upload workspace
const createBackgroundGroupActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'create',
	alias: 'LeLøgin.EntityAction.AssetGroupBackground.Create',
	name: 'Create Background Login Screen Asset Entity Action',
	forEntityTypes: [LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE],
	weight: 1200,
	meta: {
		icon: 'icon-add',
		label: '#actions_create',
	},
	conditions: [manageLeLøginScreenCondition],
};

const createBackgroundOptionManifest: UmbExtensionManifest = {
	type: 'entityCreateOptionAction',
	alias: 'LeLøgin.EntityCreateOptionAction.Asset.Background',
	name: 'Upload Background Login Screen Asset Create Option Action',
	api: () =>
		import('./upload-asset-create-option-action.js').then((m) => ({
			api: m.LeLøginScreenAssetBackgroundCreateOptionAction,
		})),
	forEntityTypes: [LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE],
	weight: 1000,
	meta: {
		icon: 'icon-picture',
		label: '#grid_media',
	},
	conditions: [manageLeLøginScreenCondition],
};

// Logos group — single option navigates directly to the logo upload workspace
const createLogoGroupActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'create',
	alias: 'LeLøgin.EntityAction.AssetGroupLogo.Create',
	name: 'Create Logo Login Screen Asset Entity Action',
	forEntityTypes: [LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE],
	weight: 1200,
	meta: {
		icon: 'icon-add',
		label: '#actions_create',
	},
	conditions: [manageLeLøginScreenCondition],
};

const createLogoOptionManifest: UmbExtensionManifest = {
	type: 'entityCreateOptionAction',
	alias: 'LeLøgin.EntityCreateOptionAction.Asset.Logo',
	name: 'Upload Logo Login Screen Asset Create Option Action',
	api: () =>
		import('./upload-asset-create-option-action.js').then((m) => ({
			api: m.LeLøginScreenAssetLogoCreateOptionAction,
		})),
	forEntityTypes: [LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE],
	weight: 900,
	meta: {
		icon: 'icon-tag',
		label: '#loginScreen_createAssetLogo',
	},
	conditions: [manageLeLøginScreenCondition],
};

const reloadAssetsActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'reloadTreeItemChildren',
	alias: 'LeLøgin.EntityAction.AssetRoot.Reload',
	name: 'Reload Login Screen Asset Tree Children Entity Action',
	forEntityTypes: [LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE],
	weight: 100,
	meta: {
		icon: 'icon-refresh',
	},
	conditions: [manageLeLøginScreenCondition],
};

const deleteAssetActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'delete',
	alias: 'LeLøgin.EntityAction.Asset.Delete',
	name: 'Delete Login Screen Asset Entity Action',
	forEntityTypes: [LOGIN_SCREEN_ASSET_ENTITY_TYPE],
	weight: 1100,
	meta: {
		icon: 'icon-trash',
		label: '#actions_delete',
		itemRepositoryAlias: ASSET_REPOSITORY_ALIAS,
		detailRepositoryAlias: ASSET_REPOSITORY_ALIAS,
		confirm: {
			headline: '#actions_delete',
			message: '#loginScreen_assetTreeDeleteMessage',
		},
	},
	conditions: [manageLeLøginScreenCondition],
};

export const manifests: Array<UmbExtensionManifest> = [
	assetRepositoryManifest,
	createBackgroundGroupActionManifest,
	createBackgroundOptionManifest,
	createLogoGroupActionManifest,
	createLogoOptionManifest,
	reloadAssetsActionManifest,
	deleteAssetActionManifest,
];
