import type {
	UmbTreeAncestorsOfRequestArgs,
	UmbTreeChildrenOfRequestArgs,
	UmbTreeRootItemsRequestArgs
} from '@umbraco-cms/backoffice/tree';
import {
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	type LeLøginScreenAnyAssetTreeItemModel
} from './types.js';
import type { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { LoginImageAssetKind } from '../models/index.js';

/**
 * The slice of {@link LeLøginScreenAssetRepository} the tree needs. Declared structurally so the
 * tree logic stays free of the backoffice runtime and can be exercised directly in tests.
 */
export type AssetItemsSource = Pick<LeLøginScreenAssetRepository, 'requestItems'>;

type AssetItemsResponse = Awaited<ReturnType<AssetItemsSource['requestItems']>>;
type AssetItemsError = NonNullable<AssetItemsResponse['error']>;

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

const KIND_BY_GROUP_ID: Record<string, LoginImageAssetKind> = {
	[GROUP_ID.background]: 'background',
	[GROUP_ID.logo]: 'logo'
};

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

export type AssetTreeServerItem = AssetTreeGroupServerItem | AssetTreeLeafServerItem;

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

export const toTreeItemModel = (item: AssetTreeServerItem): LeLøginScreenAnyAssetTreeItemModel => {
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

interface AssetTreeLeafResult {
	leaves?: AssetTreeLeafServerItem[];
	error?: AssetItemsError;
}

interface AssetTreeLeafProvider {
	clear: () => void;
	fetch: () => Promise<AssetTreeLeafResult>;
}

const createLeafProvider = (assetSource: AssetItemsSource): AssetTreeLeafProvider => {
	let leafCache: AssetTreeLeafServerItem[] | undefined;
	let fetchPromise: Promise<AssetTreeLeafResult> | undefined;

	const fetchLeaves = async (): Promise<AssetTreeLeafResult> => {
		if (leafCache !== undefined) return { leaves: leafCache };
		if (fetchPromise) return fetchPromise;
		fetchPromise = (async () => {
			const { data, error } = await assetSource.requestItems();
			if (error) {
				// Drop the shared promise so the next caller retries. Callers already awaiting it
				// still receive this error; without the reset a single transient failure would be
				// replayed to every later expansion until the whole tree is reloaded.
				fetchPromise = undefined;
				return { error };
			}
			leafCache = (data ?? []).map(toLeafServerItem);
			return { leaves: leafCache };
		})();
		return fetchPromise;
	};

	return {
		clear: () => {
			leafCache = undefined;
			fetchPromise = undefined;
		},
		fetch: fetchLeaves
	};
};

/**
 * UmbTreeServerDataSourceBase branches on `if (data)` and only falls through to `return { error }`
 * when data is absent. Returning an empty-items envelope alongside an error would therefore
 * present the failure as an empty node, so a failed read leaves `data` unset entirely.
 */
export interface AssetTreeItemsResult {
	data?: {
		items: AssetTreeServerItem[];
		total: number;
		totalBefore: number;
		totalAfter: number;
	};
	error?: AssetItemsError;
}

export interface AssetTreeAncestorsResult {
	data?: AssetTreeServerItem[];
	error?: AssetItemsError;
}

const itemsResult = (items: AssetTreeServerItem[]): AssetTreeItemsResult => ({
	data: { items, total: items.length, totalBefore: 0, totalAfter: 0 }
});

const createGetRootItems =
	(leafProvider: AssetTreeLeafProvider) =>
	async (_args: UmbTreeRootItemsRequestArgs): Promise<AssetTreeItemsResult> => {
		leafProvider.clear();
		const { error } = await leafProvider.fetch();
		if (error) return { error };
		return itemsResult([toGroupServerItem('background'), toGroupServerItem('logo')]);
	};

const createGetChildrenOf =
	(leafProvider: AssetTreeLeafProvider) =>
	async (args: UmbTreeChildrenOfRequestArgs): Promise<AssetTreeItemsResult> => {
		const kind = KIND_BY_GROUP_ID[args.parent.unique ?? ''];
		// Not one of the two groups: legitimately childless, not a failure.
		if (kind === undefined) return itemsResult([]);
		const { leaves, error } = await leafProvider.fetch();
		if (error) return { error };
		return itemsResult((leaves ?? []).filter((asset) => asset.assetKind === kind));
	};

const createGetAncestorsOf =
	(leafProvider: AssetTreeLeafProvider) =>
	async (args: UmbTreeAncestorsOfRequestArgs): Promise<AssetTreeAncestorsResult> => {
		const groupKind = KIND_BY_GROUP_ID[args.treeItem.unique];
		if (groupKind !== undefined) return { data: [] };
		const { leaves, error } = await leafProvider.fetch();
		if (error) return { error };
		const asset = (leaves ?? []).find((leaf) => leaf.id === args.treeItem.unique);
		if (asset === undefined) return { data: [] };
		return { data: [toGroupServerItem(asset.assetKind)] };
	};

export const buildDataSourceConfig = (assetSource: AssetItemsSource) => {
	// Shared across the handlers within one tree refresh cycle to avoid duplicate API calls.
	const leafProvider = createLeafProvider(assetSource);
	return {
		getRootItems: createGetRootItems(leafProvider),
		getChildrenOf: createGetChildrenOf(leafProvider),
		getAncestorsOf: createGetAncestorsOf(leafProvider),
		mapper: toTreeItemModel
	};
};
