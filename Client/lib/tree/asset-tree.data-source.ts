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

/**
 * An item as the asset tree data source produces it before mapping: either one of the two fixed
 * kind groups (background, logo) or an asset leaf. `isGroup` discriminates the union.
 */
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

/**
 * The tree group that holds assets of a kind, so callers can ask Umbraco to reload it.
 *
 * @param kind - The asset kind whose group is wanted.
 * @returns The group's `unique` and entity type, ready for a reload event.
 */
export const assetGroupEntity = (kind: LoginImageAssetKind) => ({
	unique: GROUP_ID[kind],
	entityType: GROUP_ENTITY_TYPE[kind]
});

/**
 * Maps a server item to the tree item model Umbraco renders. Groups become folders under the
 * asset root; leaves become asset entities parented to their kind's group.
 *
 * @param item - The group or leaf to map.
 * @returns The tree item model for that node.
 */
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
		parent: { unique: GROUP_ID[item.assetKind], entityType: GROUP_ENTITY_TYPE[item.assetKind] },
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
	fetch: () => Promise<AssetTreeLeafResult>;
}

/**
 * Handlers that run together (expanding both groups, resolving ancestors) share one request
 * while it is in flight. Nothing is kept afterwards: Umbraco reloads a group's children after a
 * delete or rename, and a cached list would still show the old asset.
 */
const createLeafProvider = (assetSource: AssetItemsSource): AssetTreeLeafProvider => {
	let inFlight: Promise<AssetTreeLeafResult> | undefined;

	const fetchLeaves = (): Promise<AssetTreeLeafResult> => {
		inFlight ??= (async () => {
			try {
				const { data, error } = await assetSource.requestItems();
				return error ? { error } : { leaves: (data ?? []).map(toLeafServerItem) };
			} finally {
				inFlight = undefined;
			}
		})();
		return inFlight;
	};

	return { fetch: fetchLeaves };
};

/**
 * UmbTreeServerDataSourceBase branches on `if (data)` and only falls through to `return { error }`
 * when data is absent. Returning an empty-items envelope alongside an error would therefore
 * present the failure as an empty node, so a failed read leaves `data` unset entirely.
 */
export interface AssetTreeItemsResult {
	/** The page of items; absent when the read failed. Totals describe a single unpaged page. */
	data?: {
		items: AssetTreeServerItem[];
		total: number;
		totalBefore: number;
		totalAfter: number;
	};
	/** The repository error when the asset list could not be read. */
	error?: AssetItemsError;
}

/**
 * Result of an ancestors lookup. As with {@link AssetTreeItemsResult}, `data` is left unset on
 * failure so Umbraco reports the error rather than an empty path.
 */
export interface AssetTreeAncestorsResult {
	/** The ancestor path, ending with the item itself; empty for groups and unknown items. */
	data?: AssetTreeServerItem[];
	/** The repository error when the asset list could not be read. */
	error?: AssetItemsError;
}

const itemsResult = (items: AssetTreeServerItem[]): AssetTreeItemsResult => ({
	data: { items, total: items.length, totalBefore: 0, totalAfter: 0 }
});

const createGetRootItems =
	(leafProvider: AssetTreeLeafProvider) =>
	async (_args: UmbTreeRootItemsRequestArgs): Promise<AssetTreeItemsResult> => {
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
		// Umbraco expects the item itself last; its workspace breadcrumb drops that last entry.
		return { data: [toGroupServerItem(asset.assetKind), asset] };
	};

/**
 * Builds the configuration for Umbraco's `UmbTreeServerDataSourceBase`: root, children and
 * ancestor handlers that share one in-flight asset request, plus the item mapper.
 *
 * @param assetSource - Supplies the asset list; the real repository or a test double.
 * @returns The data-source configuration object.
 */
export const buildDataSourceConfig = (assetSource: AssetItemsSource) => {
	const leafProvider = createLeafProvider(assetSource);
	return {
		getRootItems: createGetRootItems(leafProvider),
		getChildrenOf: createGetChildrenOf(leafProvider),
		getAncestorsOf: createGetAncestorsOf(leafProvider),
		mapper: toTreeItemModel
	};
};
