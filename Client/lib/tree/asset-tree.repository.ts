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

export class LeLøginScreenAssetTreeRepository
	extends UmbTreeRepositoryBase<LeLøginScreenAnyAssetTreeItemModel, LeLøginScreenAssetTreeRootModel>
	implements UmbApi
{
	constructor(host: UmbControllerHost) {
		super(host, AssetTreeDataSource);
	}

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

export { LeLøginScreenAssetTreeRepository as api };
