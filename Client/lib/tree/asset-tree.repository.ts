import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbApi } from '@umbraco-cms/backoffice/extension-api';
import {
	UmbTreeRepositoryBase,
	UmbTreeServerDataSourceBase,
	type UmbTreeAncestorsOfRequestArgs,
	type UmbTreeChildrenOfRequestArgs,
	type UmbTreeRootItemsRequestArgs
} from '@umbraco-cms/backoffice/tree';
import {
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	type LeLøginScreenAnyAssetTreeItemModel,
	type LeLøginScreenAssetTreeRootModel
} from './types.js';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { LoginImageAssetKind } from '../models/index.js';

const ASSET_KIND_ICON: Record<LoginImageAssetKind, string> = {
	background: 'icon-picture',
	logo: 'icon-tag'
};

const GROUP_ID: Record<LoginImageAssetKind, string> = {
	background: 'login-screen-assets-welcome',
	logo: 'login-screen-assets-logos'
};

const GROUP_NAME: Record<LoginImageAssetKind, string> = {
	background: '#loginScreen_assetsWelcomeImages',
	logo: '#loginScreen_assetsLogos'
};

const KIND_BY_GROUP_ID = Object.fromEntries(
	Object.entries(GROUP_ID).map(([kind, id]) => [id, kind as LoginImageAssetKind])
) as Record<string, LoginImageAssetKind>;

interface AssetTreeGroupServerItem {
	isGroup: true;
	id: string;
	name: string;
	hasChildren: true;
	groupKind: LoginImageAssetKind;
}

interface AssetTreeLeafServerItem {
	isGroup: false;
	id: string;
	name: string;
	hasChildren: false;
	icon: string;
	assetKind: LoginImageAssetKind;
}

type AssetTreeServerItem = AssetTreeGroupServerItem | AssetTreeLeafServerItem;

const toGroupServerItem = (kind: LoginImageAssetKind): AssetTreeGroupServerItem => ({
	isGroup: true,
	id: GROUP_ID[kind],
	name: GROUP_NAME[kind],
	hasChildren: true,
	groupKind: kind
});

const toLeafServerItem = (asset: {
	id: string;
	name: string;
	kind: LoginImageAssetKind;
}): AssetTreeLeafServerItem => ({
	isGroup: false,
	id: asset.id,
	name: asset.name,
	hasChildren: false,
	icon: ASSET_KIND_ICON[asset.kind],
	assetKind: asset.kind
});

const GROUP_ENTITY_TYPE = {
	background: LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	logo: LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE
} as const;

const toTreeItemModel = (item: AssetTreeServerItem): LeLøginScreenAnyAssetTreeItemModel => {
	if (item.isGroup) {
		return {
			unique: item.id,
			parent: { unique: null, entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE },
			name: item.name,
			entityType: GROUP_ENTITY_TYPE[item.groupKind],
			hasChildren: true,
			isFolder: true,
			icon: ASSET_KIND_ICON[item.groupKind]
		};
	}
	return {
		unique: item.id,
		parent: { unique: null, entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE },
		name: item.name,
		entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE,
		hasChildren: false,
		isFolder: false,
		icon: item.icon
	};
};

const buildDataSourceConfig = (assetRepository: LeLøginScreenAssetRepository) => {
	// Shared cache populated by getRootItems and reused by getChildrenOf/getAncestorsOf
	// within the same tree refresh cycle. Avoids concurrent duplicate API calls.
	let leafCache: AssetTreeLeafServerItem[] | undefined;

	const fetchLeaves = async (): Promise<{ leaves?: AssetTreeLeafServerItem[]; error?: Error }> => {
		if (leafCache !== undefined) return { leaves: leafCache };
		const { data, error } = await assetRepository.requestItems();
		if (error) return { error };
		leafCache = (data ?? []).map(toLeafServerItem);
		return { leaves: leafCache };
	};

	return {
		getRootItems: async (_args: UmbTreeRootItemsRequestArgs) => {
			leafCache = undefined;
			await fetchLeaves();
			const items: AssetTreeServerItem[] = [
				toGroupServerItem('background'),
				toGroupServerItem('logo')
			];
			return { data: { items, total: items.length }, error: undefined };
		},

		getChildrenOf: async (args: UmbTreeChildrenOfRequestArgs) => {
			const kind = KIND_BY_GROUP_ID[args.parent.unique ?? ''];
			if (kind === undefined) {
				return { data: { items: [] as AssetTreeServerItem[], total: 0 } };
			}
			const { leaves, error } = await fetchLeaves();
			if (error) {
				return { data: { items: [] as AssetTreeServerItem[], total: 0 }, error };
			}
			const items = (leaves ?? []).filter((a) => a.assetKind === kind);
			return { data: { items, total: items.length }, error: undefined };
		},

		getAncestorsOf: async (args: UmbTreeAncestorsOfRequestArgs) => {
			const groupKind = KIND_BY_GROUP_ID[args.treeItem.unique ?? ''];
			if (groupKind !== undefined) {
				return { data: [] as AssetTreeServerItem[] };
			}
			const { leaves } = await fetchLeaves();
			const asset = (leaves ?? []).find((a) => a.id === args.treeItem.unique);
			if (asset === undefined) {
				return { data: [] as AssetTreeServerItem[] };
			}
			return { data: [toGroupServerItem(asset.assetKind)] };
		},

		mapper: toTreeItemModel
	};
};

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
