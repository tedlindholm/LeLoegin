import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbApi } from '@umbraco-cms/backoffice/extension-api';
import { UmbTreeRepositoryBase, UmbTreeServerDataSourceBase } from '@umbraco-cms/backoffice/tree';
import {
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	type LeLøginScreenAnyAssetTreeItemModel,
	type LeLøginScreenAssetTreeRootModel
} from './types.js';
import { buildDataSourceConfig, type AssetTreeServerItem } from './asset-tree.data-source.js';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';

class AssetTreeDataSource extends UmbTreeServerDataSourceBase<
	AssetTreeServerItem,
	LeLøginScreenAnyAssetTreeItemModel
> {
	constructor(host: UmbControllerHost) {
		super(host, buildDataSourceConfig(new LeLøginScreenAssetRepository(host)));
	}
}

/**
 * Tree repository behind `LeLøgin.Tree.Assets`. Supplies the fixed asset root and delegates
 * groups and leaves to the asset tree data source.
 */
export class LeLøginScreenAssetTreeRepository
	extends UmbTreeRepositoryBase<LeLøginScreenAnyAssetTreeItemModel, LeLøginScreenAssetTreeRootModel>
	implements UmbApi
{
	/**
	 * @param host - The controller host that owns the repository.
	 */
	constructor(host: UmbControllerHost) {
		super(host, AssetTreeDataSource);
	}

	/**
	 * Returns the static asset root node. No request is made; the root always exists.
	 *
	 * @returns A response envelope holding the root model.
	 */
	async requestTreeRoot() {
		const data: LeLøginScreenAssetTreeRootModel = {
			unique: null,
			entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
			name: '#loginScreen_assets',
			icon: 'icon-picture',
			hasChildren: true,
			isFolder: true
		};
		return { data };
	}
}

/** Exported as `api` so the manifest's lazy import resolves the repository. */
export { LeLøginScreenAssetTreeRepository as api };
