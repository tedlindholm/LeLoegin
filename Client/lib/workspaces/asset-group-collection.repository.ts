import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbCollectionRepository } from '@umbraco-cms/backoffice/collection';
import type { UmbCollectionFilterModel } from '@umbraco-cms/backoffice/collection';
import type { LoginImageAssetKind } from '../models/index.js';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import { LOGIN_SCREEN_ASSET_ENTITY_TYPE } from '../tree/types.js';
import { UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT } from './asset-group-workspace.context.js';

export interface LeLøginAssetCollectionItemModel {
	unique: string;
	entityType: string;
	name: string;
	altText: string | undefined;
	editHref: string;
}

export class LeLøginScreenAssetGroupCollectionRepository
	extends UmbRepositoryBase
	implements UmbCollectionRepository<LeLøginAssetCollectionItemModel>
{
	#assetRepository = new LeLøginScreenAssetRepository(this);
	#kind: LoginImageAssetKind | undefined;

	constructor(host: UmbControllerHost) {
		super(host);

		this.consumeContext(UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT, (ctx) => {
			if (ctx === undefined) return;
			this.observe(ctx.kind, (kind) => {
				this.#kind = kind;
			});
		});
	}

	/**
	 * Fetches the group's assets afresh on every request. Umbraco's collection reloads after a
	 * delete or rename of an asset it shows; a cached list would still contain the old asset.
	 */
	async requestCollection(_filter?: UmbCollectionFilterModel) {
		const { data, error } = await this.#assetRepository.requestItems();
		if (error) return { error };

		const assets = (data ?? []).filter((asset) => asset.kind === this.#kind);
		const items: Array<LeLøginAssetCollectionItemModel> = assets.map((asset) => ({
			unique: asset.id,
			entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE,
			name: asset.name,
			altText: asset.altText,
			editHref: `/umbraco/section/settings/workspace/${LOGIN_SCREEN_ASSET_ENTITY_TYPE}/edit/${encodeURIComponent(asset.id)}`
		}));

		return { data: { items, total: items.length }, error: undefined };
	}
}

export { LeLøginScreenAssetGroupCollectionRepository as api };
