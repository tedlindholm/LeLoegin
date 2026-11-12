import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbCollectionRepository } from '@umbraco-cms/backoffice/collection';
import type { UmbCollectionFilterModel } from '@umbraco-cms/backoffice/collection';
import type { LoginImageAssetKind } from '../models/index.js';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import { LOGIN_SCREEN_ASSET_ENTITY_TYPE } from '../tree/types.js';
import { UMB_LOGIN_SCREEN_ASSET_GROUP_WORKSPACE_CONTEXT } from './asset-group-workspace.context.js';

/** One asset as the asset group collection lists it. */
export interface LeLøginAssetCollectionItemModel {
	/** Asset id. */
	unique: string;
	/** Always the login-screen asset entity type. */
	entityType: string;
	/** Display name of the asset. */
	name: string;
	/** Alternative text, if the asset has any. */
	altText: string | undefined;
	/** Backoffice URL of the asset's edit workspace. */
	editHref: string;
}

/**
 * Collection repository for an asset group workspace: lists the assets whose kind matches the
 * group (background or logo), read from the surrounding asset group workspace context.
 */
export class LeLøginScreenAssetGroupCollectionRepository
	extends UmbRepositoryBase
	implements UmbCollectionRepository<LeLøginAssetCollectionItemModel>
{
	#assetRepository = new LeLøginScreenAssetRepository(this);
	#kind: LoginImageAssetKind | undefined;

	/**
	 * @param host - Controller host; must sit inside an asset group workspace so the kind can be consumed.
	 */
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
	 *
	 * @param _filter - Ignored; the group is small and returned in full.
	 * @returns The group's assets and their total, or the repository error.
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
