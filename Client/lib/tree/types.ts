import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';

export const LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE = 'login-screen-asset-root';
export const LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE = 'login-screen-asset-group';
export const LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE =
	'login-screen-asset-group-background';
export const LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE = 'login-screen-asset-group-logo';
export const LOGIN_SCREEN_ASSET_ENTITY_TYPE = 'login-screen-asset';
export const LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE =
	'login-screen-asset-upload-background';
export const LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE = 'login-screen-asset-upload-logo';

export interface LeLøginScreenAssetGroupTreeItemModel extends UmbTreeItemModel {
	entityType:
		| typeof LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE
		| typeof LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE
		| typeof LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE;
}

export interface LeLøginScreenAssetTreeItemModel extends UmbTreeItemModel {
	entityType: typeof LOGIN_SCREEN_ASSET_ENTITY_TYPE;
}

export type LeLøginScreenAnyAssetTreeItemModel =
	| LeLøginScreenAssetGroupTreeItemModel
	| LeLøginScreenAssetTreeItemModel;

export interface LeLøginScreenAssetTreeRootModel extends UmbTreeRootModel {
	entityType: typeof LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE;
}
