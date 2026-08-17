import { describe, expect, it } from 'vitest';
import type { UmbTreeChildrenOfRequestArgs } from '@umbraco-cms/backoffice/tree';
import { buildDataSourceConfig, type AssetItemsSource } from './asset-tree.data-source.js';
import {
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE
} from './types.js';
import type { LoginImageAsset, LoginImageAssetKind } from '../models/index.js';
import type { LeLøginScreenAssetRepositoryResponse } from '../assets/asset.repository.js';

// The group ids the tree exposes to Umbraco. Asserted literally so a rename shows up as a
// failing test rather than as a silently unexpandable node.
const BACKGROUND_GROUP_ID = 'login-screen-assets-welcome';
const LOGO_GROUP_ID = 'login-screen-assets-logos';

type AssetItemsError = NonNullable<LeLøginScreenAssetRepositoryResponse['error']>;

const apiError = (message: string) => new Error(message) as unknown as AssetItemsError;

const asset = (id: string, kind: LoginImageAssetKind): LoginImageAsset => ({
	id,
	name: `${id} name`,
	kind,
	storagePath: `assets/${id}.jpg`,
	width: 1920,
	height: 1080,
	createdAt: '2026-01-01T00:00:00Z',
	updatedAt: '2026-01-01T00:00:00Z'
});

const success = (...assets: LoginImageAsset[]): LeLøginScreenAssetRepositoryResponse => ({
	data: assets,
	error: undefined
});

const failure = (message: string): LeLøginScreenAssetRepositoryResponse => ({
	data: undefined,
	error: apiError(message)
});

/**
 * Stub asset source that replays a queued list of responses, holding every call open until the
 * returned gate is released. The last queued response repeats once the queue is exhausted.
 */
const createSource = (...responses: LeLøginScreenAssetRepositoryResponse[]) => {
	let callCount = 0;
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const source: AssetItemsSource & { readonly callCount: number; open: () => void } = {
		get callCount() {
			return callCount;
		},
		open: () => release(),
		requestItems: async () => {
			const response = responses.at(Math.min(callCount, responses.length - 1));
			if (response === undefined) throw new Error('createSource needs at least one response');
			callCount += 1;
			await gate;
			return response;
		}
	};
	return source;
};

/** Source that resolves immediately — the common case for sequential assertions. */
const createOpenSource = (...responses: LeLøginScreenAssetRepositoryResponse[]) => {
	const source = createSource(...responses);
	source.open();
	return source;
};

const childrenArgs = (unique: string): UmbTreeChildrenOfRequestArgs => ({
	parent: {
		unique,
		entityType:
			unique === LOGO_GROUP_ID
				? LOGIN_SCREEN_ASSET_GROUP_LOGO_ENTITY_TYPE
				: LOGIN_SCREEN_ASSET_GROUP_BACKGROUND_ENTITY_TYPE
	}
});

const ancestorsArgs = (unique: string) => ({
	treeItem: { unique, entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE }
});

describe('asset tree data source — error propagation', () => {
	// UmbTreeServerDataSourceBase does `if (data) { …return { data } } return { error }`. Any
	// truthy data — including an empty-items envelope — makes it take the success branch and
	// discard the error, so a failed request must resolve without data at all.
	it('omits data from getRootItems when the request fails', async () => {
		const config = buildDataSourceConfig(createOpenSource(failure('root boom')));

		const result = await config.getRootItems({});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeDefined();
	});

	it('omits data from getChildrenOf when the request fails', async () => {
		const config = buildDataSourceConfig(createOpenSource(failure('children boom')));

		const result = await config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));

		expect(result.data).toBeUndefined();
		expect(result.error).toBeDefined();
	});

	it('omits data from getAncestorsOf when the request fails', async () => {
		const config = buildDataSourceConfig(createOpenSource(failure('ancestors boom')));

		const result = await config.getAncestorsOf(ancestorsArgs('asset-1'));

		expect(result.data).toBeUndefined();
		expect(result.error).toBeDefined();
	});

	it('reports an unknown parent as empty rather than as a failure', async () => {
		const config = buildDataSourceConfig(createOpenSource(success(asset('a1', 'background'))));

		const result = await config.getChildrenOf(childrenArgs('not-a-group'));

		expect(result.error).toBeUndefined();
		expect(result.data?.items).toEqual([]);
		expect(result.data?.total).toBe(0);
	});
});

describe('asset tree data source — successful reads', () => {
	it('returns both groups as root items with paging fields', async () => {
		const config = buildDataSourceConfig(createOpenSource(success(asset('a1', 'background'))));

		const result = await config.getRootItems({});

		expect(result.error).toBeUndefined();
		expect(result.data?.items.map((item) => item.id)).toEqual([BACKGROUND_GROUP_ID, LOGO_GROUP_ID]);
		expect(result.data?.total).toBe(2);
		expect(result.data?.totalBefore).toBe(0);
		expect(result.data?.totalAfter).toBe(0);
	});

	it('filters children by the group kind', async () => {
		const config = buildDataSourceConfig(
			createOpenSource(
				success(asset('bg-1', 'background'), asset('logo-1', 'logo'), asset('bg-2', 'background'))
			)
		);

		const result = await config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));

		expect(result.data?.items.map((item) => item.id)).toEqual(['bg-1', 'bg-2']);
		expect(result.data?.total).toBe(2);
	});

	it('resolves an asset to its owning group', async () => {
		const config = buildDataSourceConfig(createOpenSource(success(asset('logo-1', 'logo'))));

		const result = await config.getAncestorsOf(ancestorsArgs('logo-1'));

		expect(result.data?.map((item) => item.id)).toEqual([LOGO_GROUP_ID]);
	});
});

describe('asset tree data source — leaf caching', () => {
	it('shares a single in-flight request between concurrent handlers', async () => {
		const source = createSource(success(asset('bg-1', 'background'), asset('logo-1', 'logo')));
		const config = buildDataSourceConfig(source);

		const background = config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));
		const logo = config.getChildrenOf(childrenArgs(LOGO_GROUP_ID));
		source.open();
		await Promise.all([background, logo]);

		expect(source.callCount).toBe(1);
	});

	it('reuses cached leaves for later group expansions', async () => {
		const source = createOpenSource(success(asset('bg-1', 'background')));
		const config = buildDataSourceConfig(source);

		await config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));
		await config.getChildrenOf(childrenArgs(LOGO_GROUP_ID));

		expect(source.callCount).toBe(1);
	});

	it('refetches when the root is reloaded', async () => {
		const source = createOpenSource(success(asset('bg-1', 'background')));
		const config = buildDataSourceConfig(source);

		await config.getRootItems({});
		await config.getRootItems({});

		expect(source.callCount).toBe(2);
	});
});

describe('asset tree data source — failure recovery', () => {
	// A memoised rejection would leave every later expansion stuck on the original failure until
	// the whole tree is reloaded, so a transient error must not be cached.
	it('retries after a failed request instead of caching the failure', async () => {
		const source = createOpenSource(failure('transient'), success(asset('bg-1', 'background')));
		const config = buildDataSourceConfig(source);

		const failed = await config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));
		const retried = await config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));

		expect(failed.error).toBeDefined();
		expect(source.callCount).toBe(2);
		expect(retried.error).toBeUndefined();
		expect(retried.data?.items.map((item) => item.id)).toEqual(['bg-1']);
	});

	it('lets concurrent callers of a failed request retry afterwards', async () => {
		const source = createSource(failure('transient'), success(asset('bg-1', 'background')));
		const config = buildDataSourceConfig(source);

		const background = config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));
		const logo = config.getChildrenOf(childrenArgs(LOGO_GROUP_ID));
		source.open();
		const [backgroundResult, logoResult] = await Promise.all([background, logo]);

		expect(backgroundResult.error).toBeDefined();
		expect(logoResult.error).toBeDefined();
		expect(source.callCount).toBe(1);

		const retried = await config.getChildrenOf(childrenArgs(BACKGROUND_GROUP_ID));
		expect(retried.error).toBeUndefined();
		expect(retried.data?.items.map((item) => item.id)).toEqual(['bg-1']);
	});
});
