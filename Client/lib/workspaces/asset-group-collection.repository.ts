import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbCollectionRepository } from '@umbraco-cms/backoffice/collection';
import type { UmbCollectionFilterModel } from '@umbraco-cms/backoffice/collection';
import type { LoginImageAsset } from '../models/index.js';
import { LOGIN_SCREEN_ASSET_ENTITY_TYPE } from '../tree/types.js';
import {
	UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT,
} from './asset-group-workspace.context.js';

export interface LeLøginAssetCollectionItemModel {
	unique: string;
	entityType: string;
	name: string;
	altText: string | undefined;
	thumbnailUrl: string;
	editHref: string;
}

export class LeLøginScreenAssetGroupCollectionRepository
	extends UmbRepositoryBase
	implements UmbCollectionRepository<LeLøginAssetCollectionItemModel>
{
	#assets: Array<LoginImageAsset> = [];

	constructor(host: UmbControllerHost) {
		super(host);

		this.consumeContext(UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT, (ctx) => {
			if (ctx === undefined) return;
			this.observe(ctx.assets, (assets) => {
				this.#assets = assets;
			});
		});
	}

	async requestCollection(_filter?: UmbCollectionFilterModel) {
		const items: Array<LeLøginAssetCollectionItemModel> = this.#assets.map((asset) => ({
			unique: asset.id,
			entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE,
			name: asset.name,
			altText: asset.altText,
			thumbnailUrl: `/umbraco/le-løgin/api/v1/assets/${encodeURIComponent(asset.id)}/thumbnail`,
			editHref: `/umbraco/section/settings/workspace/${LOGIN_SCREEN_ASSET_ENTITY_TYPE}/edit/${encodeURIComponent(asset.id)}`,
		}));

		return { data: { items, total: items.length }, error: undefined };
	}
}

export { LeLøginScreenAssetGroupCollectionRepository as api };
