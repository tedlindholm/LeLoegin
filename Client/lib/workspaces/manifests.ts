import type { ManifestWorkspace } from '@umbraco-cms/backoffice/workspace';
import {
	UMB_WORKSPACE_CONDITION_ALIAS,
	UmbSubmitWorkspaceAction,
} from '@umbraco-cms/backoffice/workspace';
import {
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE,
} from '../tree/types.js';
import {
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
} from '../rules/entity-types.js';

export const LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS = 'LeLøgin.Workspace.Asset';
export const LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_WORKSPACE_ALIAS =
	'LeLøgin.Workspace.AssetUpload.Background';
export const LOGIN_SCREEN_ASSET_UPLOAD_LOGO_WORKSPACE_ALIAS =
	'LeLøgin.Workspace.AssetUpload.Logo';

const rootWorkspaceManifest = {
	type: 'workspace',
	alias: 'LeLøgin.Workspace.Root',
	name: 'Login Screen Root Workspace',
	element: () => import('./root-workspace.element.js'),
	meta: {
		entityType: 'login-screen-root',
	},
} satisfies ManifestWorkspace;

const assetRootWorkspaceManifest = {
	type: 'workspace',
	alias: 'LeLøgin.Workspace.AssetRoot',
	name: 'Login Screen Asset Root Workspace',
	element: () => import('./asset-root-workspace.element.js'),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetGroupWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: 'LeLøgin.Workspace.AssetGroup',
	name: 'Login Screen Asset Group Workspace',
	api: () => import('./asset-group-workspace.context.js'),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetGroupBackgroundWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: 'LeLøgin.Workspace.AssetGroup.Background',
	name: 'Login Screen Background Asset Group Workspace',
	api: () => import('./asset-group-workspace.context.js'),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetGroupLogoWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: 'LeLøgin.Workspace.AssetGroup.Logo',
	name: 'Login Screen Logo Asset Group Workspace',
	api: () => import('./asset-group-workspace.context.js'),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS,
	name: 'Login Screen Asset Workspace',
	api: () => import('./asset-editor-workspace.context.js'),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetWorkspaceSaveActionManifest = {
	type: 'workspaceAction',
	kind: 'default',
	alias: 'LeLøgin.WorkspaceAction.Asset.Save',
	name: 'Save Login Screen Asset Workspace Action',
	api: UmbSubmitWorkspaceAction,
	meta: {
		label: '#buttons_save',
		look: 'primary',
		color: 'positive',
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS,
		},
	],
};

const assetUploadBackgroundWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_WORKSPACE_ALIAS,
	name: 'Login Screen Background Asset Upload Workspace',
	api: () =>
		import('./asset-upload-workspace.context.js').then((module) => ({
			api: module.LeLøginScreenAssetUploadBackgroundWorkspaceContext,
		})),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetUploadLogoWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_WORKSPACE_ALIAS,
	name: 'Login Screen Logo Asset Upload Workspace',
	api: () =>
		import('./asset-upload-workspace.context.js').then((module) => ({
			api: module.LeLøginScreenAssetUploadLogoWorkspaceContext,
		})),
	meta: {
		entityType: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const assetUploadBackgroundSaveActionManifest = {
	type: 'workspaceAction',
	kind: 'default',
	alias: 'LeLøgin.WorkspaceAction.AssetUpload.Background.Save',
	name: 'Save Login Screen Background Upload Workspace Action',
	api: UmbSubmitWorkspaceAction,
	meta: {
		label: '#buttons_save',
		look: 'primary',
		color: 'positive',
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_WORKSPACE_ALIAS,
		},
	],
};

const assetUploadLogoSaveActionManifest = {
	type: 'workspaceAction',
	kind: 'default',
	alias: 'LeLøgin.WorkspaceAction.AssetUpload.Logo.Save',
	name: 'Save Login Screen Logo Upload Workspace Action',
	api: UmbSubmitWorkspaceAction,
	meta: {
		label: '#buttons_save',
		look: 'primary',
		color: 'positive',
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_ASSET_UPLOAD_LOGO_WORKSPACE_ALIAS,
		},
	],
};

const ruleListWorkspaceManifest = {
	type: 'workspace',
	alias: 'LeLøgin.Workspace.RuleList',
	name: 'Login Screen Rule List Workspace',
	element: () => import('./rule-list-workspace.element.js'),
	meta: {
		entityType: LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const LOGIN_SCREEN_RULE_WORKSPACE_ALIAS = 'LeLøgin.Workspace.Rule';

const ruleWorkspaceManifest = {
	type: 'workspace',
	kind: 'routable',
	alias: LOGIN_SCREEN_RULE_WORKSPACE_ALIAS,
	name: 'Login Screen Rule Workspace',
	api: () => import('./rule-editor-workspace.context.js'),
	meta: {
		entityType: LOGIN_SCREEN_RULE_ENTITY_TYPE,
	},
} satisfies ManifestWorkspace;

const ruleWorkspaceSaveActionManifest = {
	type: 'workspaceAction',
	kind: 'default',
	alias: 'LeLøgin.WorkspaceAction.Rule.Save',
	name: 'Save Login Screen Rule Workspace Action',
	api: UmbSubmitWorkspaceAction,
	meta: {
		label: '#buttons_save',
		look: 'primary',
		color: 'positive',
	},
	conditions: [
		{
			alias: UMB_WORKSPACE_CONDITION_ALIAS,
			match: LOGIN_SCREEN_RULE_WORKSPACE_ALIAS,
		},
	],
};

const logoPickerModalManifest = {
	type: 'modal',
	alias: 'LeLøgin.Modal.LogoPicker',
	name: 'Login Screen Logo Picker Modal',
	element: () => import('./logo-picker-modal.element.js'),
};

const createAssetModalManifest = {
	type: 'modal',
	alias: 'LeLøgin.Modal.CreateAsset',
	name: 'Login Screen Create Asset Modal',
	element: () => import('./create-asset-modal.element.js'),
};

const imageUploadPreviewManifest = {
	type: 'fileUploadPreview',
	alias: 'LeLøgin.FileUploadPreview.Image',
	name: 'Login Screen Image Upload Preview',
	weight: 100,
	element: () => import('./image-upload-preview.element.js'),
	forMimeTypes: ['image/*'],
} as unknown as UmbExtensionManifest;

const assetGroupCollectionRepositoryManifest: UmbExtensionManifest = {
	type: 'repository',
	alias: 'LeLøgin.Repository.AssetGroupCollection',
	name: 'Login Screen Asset Group Collection Repository',
	api: () => import('./asset-group-collection.repository.js'),
};

const assetGroupCollectionManifest: UmbExtensionManifest = {
	type: 'collection',
	kind: 'default',
	alias: 'LeLøgin.Collection.AssetGroup',
	name: 'Login Screen Asset Group Collection',
	meta: {
		repositoryAlias: assetGroupCollectionRepositoryManifest.alias,
	},
};

const assetGroupCardCollectionViewManifest: UmbExtensionManifest = {
	type: 'collectionView',
	alias: 'LeLøgin.CollectionView.AssetGroup.Grid',
	name: 'Login Screen Asset Group Grid View',
	element: () => import('./asset-group-card-collection-view.element.js'),
	meta: {
		label: 'Grid',
		icon: 'icon-grid',
		pathName: 'grid',
	},
	conditions: [
		{
			alias: 'Umb.Condition.CollectionAlias',
			match: assetGroupCollectionManifest.alias,
		},
	],
};

export const manifests = [
	rootWorkspaceManifest,
	logoPickerModalManifest,
	createAssetModalManifest,
	imageUploadPreviewManifest,
	assetRootWorkspaceManifest,
	assetGroupWorkspaceManifest,
	assetGroupBackgroundWorkspaceManifest,
	assetGroupLogoWorkspaceManifest,
	assetGroupCollectionRepositoryManifest,
	assetGroupCollectionManifest,
	assetGroupCardCollectionViewManifest,
	assetWorkspaceManifest,
	assetWorkspaceSaveActionManifest,
	assetUploadBackgroundWorkspaceManifest,
	assetUploadBackgroundSaveActionManifest,
	assetUploadLogoWorkspaceManifest,
	assetUploadLogoSaveActionManifest,
	ruleListWorkspaceManifest,
	ruleWorkspaceManifest,
	ruleWorkspaceSaveActionManifest,
];
