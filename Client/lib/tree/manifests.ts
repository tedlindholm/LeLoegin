import {
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
} from './types.js';
import { UMB_WORKSPACE_CONDITION_ALIAS } from '@umbraco-cms/backoffice/workspace';
import { LOGIN_SCREEN_SETTINGS_MENU_ALIAS } from '../section/manifests.ts';
import { manifests as entityActionManifests } from './entity-actions/manifests.js';
import { createLeLøginScreenManagePermissionCondition } from '../user-permissions/constants.js';
import {
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_WORKSPACE_ALIAS,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_WORKSPACE_ALIAS,
	LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS,
} from '../workspaces/manifests.js';

const TREE_ALIAS = 'LeLøgin.Tree.Assets';
const manageLeLøginScreenCondition = createLeLøginScreenManagePermissionCondition();

const repositoryManifest: UmbExtensionManifest = {
	type: 'repository',
	alias: 'LeLøgin.Repository.AssetTree',
	name: 'Login Screen Asset Tree Repository',
	api: () => import('./asset-tree.repository.js'),
	conditions: [manageLeLøginScreenCondition],
};

const treeManifest: UmbExtensionManifest = {
	type: 'tree',
	kind: 'default',
	alias: TREE_ALIAS,
	name: 'Login Screen Asset Tree',
	meta: {
		repositoryAlias: repositoryManifest.alias,
	},
	conditions: [manageLeLøginScreenCondition],
};

const treeItemManifest: UmbExtensionManifest = {
	type: 'treeItem',
	kind: 'default',
	alias: 'LeLøgin.TreeItem.Asset',
	name: 'Login Screen Asset Tree Item',
	forEntityTypes: [
		LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
		LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
		LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
		LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	],
};

const menuItemManifest: UmbExtensionManifest = {
	type: 'menuItem',
	kind: 'tree',
	alias: 'LeLøgin.MenuItem.Assets',
	name: 'Login Screen Assets Menu Item',
	weight: 10,
	meta: {
		label: '#loginScreen_assets',
		icon: 'icon-picture',
		entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
		menus: [LOGIN_SCREEN_SETTINGS_MENU_ALIAS],
		treeAlias: TREE_ALIAS,
		hideTreeRoot: false,
	},
	conditions: [manageLeLøginScreenCondition],
};

const assetWorkspaceMenuStructureManifest: UmbExtensionManifest = {
	type: 'workspaceContext',
	kind: 'menuStructure',
	alias: 'LeLøgin.Context.Asset.Menu.Structure',
	name: 'Login Screen Asset Menu Structure Workspace Context',
	api: () => import('./asset-menu-structure.context.js'),
	meta: {
		menuItemAlias: menuItemManifest.alias,
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS,
		},
	],
};

const assetWorkspaceBreadcrumbManifest: UmbExtensionManifest = {
	type: 'workspaceFooterApp',
	kind: 'menuBreadcrumb',
	alias: 'LeLøgin.WorkspaceFooterApp.Asset.Breadcrumb',
	name: 'Login Screen Asset Breadcrumb Workspace Footer App',
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS,
		},
	],
};

const assetUploadBackgroundMenuStructureManifest: UmbExtensionManifest = {
	type: 'workspaceContext',
	kind: 'menuStructure',
	alias: 'LeLøgin.Context.AssetUpload.Background.Menu.Structure',
	name: 'Login Screen Asset Upload Background Menu Structure Workspace Context',
	api: () => import('./asset-menu-structure.context.js'),
	meta: {
		menuItemAlias: menuItemManifest.alias,
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_WORKSPACE_ALIAS,
		},
	],
};

const assetUploadBackgroundBreadcrumbManifest: UmbExtensionManifest = {
	type: 'workspaceFooterApp',
	kind: 'menuBreadcrumb',
	alias: 'LeLøgin.WorkspaceFooterApp.AssetUpload.Background.Breadcrumb',
	name: 'Login Screen Asset Upload Background Breadcrumb Workspace Footer App',
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_WORKSPACE_ALIAS,
		},
	],
};

const assetUploadLogoMenuStructureManifest: UmbExtensionManifest = {
	type: 'workspaceContext',
	kind: 'menuStructure',
	alias: 'LeLøgin.Context.AssetUpload.Logo.Menu.Structure',
	name: 'Login Screen Asset Upload Logo Menu Structure Workspace Context',
	api: () => import('./asset-menu-structure.context.js'),
	meta: {
		menuItemAlias: menuItemManifest.alias,
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_WORKSPACE_ALIAS,
		},
	],
};

const assetUploadLogoBreadcrumbManifest: UmbExtensionManifest = {
	type: 'workspaceFooterApp',
	kind: 'menuBreadcrumb',
	alias: 'LeLøgin.WorkspaceFooterApp.AssetUpload.Logo.Breadcrumb',
	name: 'Login Screen Asset Upload Logo Breadcrumb Workspace Footer App',
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_WORKSPACE_ALIAS,
		},
	],
};

export const manifests: Array<UmbExtensionManifest> = [
	repositoryManifest,
	treeManifest,
	treeItemManifest,
	menuItemManifest,
	assetWorkspaceMenuStructureManifest,
	assetWorkspaceBreadcrumbManifest,
	assetUploadBackgroundMenuStructureManifest,
	assetUploadBackgroundBreadcrumbManifest,
	assetUploadLogoMenuStructureManifest,
	assetUploadLogoBreadcrumbManifest,
	...entityActionManifests,
];
