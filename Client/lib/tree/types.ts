import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';

/** Entity type of the asset tree root (the Assets menu item). */
export const LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE = 'login-screen-asset-root';
/** Generic asset group entity type, shared by both kind-specific groups. */
export const LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE = 'login-screen-asset-group';
/** Entity type of the group that holds background (welcome) images. */
export const LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE =
	'login-screen-asset-group-background';
/** Entity type of the group that holds logos. */
export const LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE = 'login-screen-asset-group-logo';
/** Entity type of a single uploaded asset. */
export const LOGIN_SCREEN_ASSET_ENTITY_TYPE = 'login-screen-asset';
/** Entity type that routes to the background upload workspace. */
export const LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE =
	'login-screen-asset-upload-background';
/** Entity type that routes to the logo upload workspace. */
export const LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE = 'login-screen-asset-upload-logo';

/** Tree item model for an asset group folder. */
export interface LeLøginScreenAssetGroupTreeItemModel extends UmbTreeItemModel {
	/** One of the group entity types; the kind-specific ones decide which create options apply. */
	entityType:
		| typeof LOGIN_SCREEN_ASSET_GROUP_ENTITY_TYPE
		| typeof LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE
		| typeof LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE;
}

/** Tree item model for a single asset leaf. */
export interface LeLøginScreenAssetTreeItemModel extends UmbTreeItemModel {
	/** Always the asset entity type. */
	entityType: typeof LOGIN_SCREEN_ASSET_ENTITY_TYPE;
}

/** Any non-root node in the asset tree: a group folder or an asset leaf. */
export type LeLøginScreenAnyAssetTreeItemModel =
	| LeLøginScreenAssetGroupTreeItemModel
	| LeLøginScreenAssetTreeItemModel;

/** Model for the asset tree root. */
export interface LeLøginScreenAssetTreeRootModel extends UmbTreeRootModel {
	/** Always the asset root entity type. */
	entityType: typeof LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE;
}
