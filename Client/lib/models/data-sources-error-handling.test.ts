import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
	getAssetsMock,
	getAssetsByIdMock,
	putAssetsByIdMock,
	getRulesMock,
	getRulesByIdMock,
	getConditionMetadataMock
} = vi.hoisted(() => ({
	getAssetsMock: vi.fn(),
	getAssetsByIdMock: vi.fn(),
	putAssetsByIdMock: vi.fn(),
	getRulesMock: vi.fn(),
	getRulesByIdMock: vi.fn(),
	getConditionMetadataMock: vi.fn()
}));

vi.mock('@umbraco-cms/backoffice/class-api', () => ({
	UmbControllerBase: class {}
}));

vi.mock('@umbraco-cms/backoffice/repository', () => ({
	UmbRepositoryBase: class {}
}));

vi.mock('@umbraco-cms/backoffice/resources', () => ({
	tryExecute: async (_host: unknown, request: Promise<unknown>) => await request
}));

vi.mock('../api/index.js', () => ({
	V1: {
		getAssets: getAssetsMock,
		getAssetsById: getAssetsByIdMock,
		putAssetsById: putAssetsByIdMock,
		getRules: getRulesMock,
		getRulesById: getRulesByIdMock,
		getRulesConditionMetadata: getConditionMetadataMock
	}
}));

import { LeLøginScreenAssetDataSource } from '../assets/asset.data-source.js';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import { LeLøginScreenConditionMetadataDataSource } from '../rules/condition-metadata.data-source.js';
import { LeLøginScreenRuleDataSource } from '../rules/rule.data-source.js';

const stubHost: UmbControllerHost = {
	getHostElement: () => {
		throw new Error('Not expected in unit test');
	},
	addUmbController: () => {},
	removeUmbController: () => {},
	removeUmbControllerByAlias: () => {},
	hasUmbController: () => false,
	getUmbControllers: () => []
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe('data source adapter error handling (3.8)', () => {
	it('catches malformed asset list and item responses instead of rejecting', async () => {
		const dataSource = new LeLøginScreenAssetDataSource(stubHost);
		getAssetsMock.mockResolvedValueOnce({ data: 'not-an-array', error: undefined });
		const listResult = await dataSource.getAssets();
		expect(listResult.data).toBeUndefined();
		expect(listResult.error).toBeInstanceOf(Error);

		getAssetsByIdMock.mockResolvedValueOnce({ data: { id: 123 }, error: undefined });
		const itemResult = await dataSource.getAsset('asset-1');
		expect(itemResult.data).toBeUndefined();
		expect(itemResult.error).toBeInstanceOf(Error);
	});

	it('catches malformed rule list and item responses instead of rejecting', async () => {
		const dataSource = new LeLøginScreenRuleDataSource(stubHost);
		getRulesMock.mockResolvedValueOnce({ data: 'not-an-array', error: undefined });
		const listResult = await dataSource.getRules();
		expect(listResult.data).toBeUndefined();
		expect(listResult.error).toBeInstanceOf(Error);

		getRulesByIdMock.mockResolvedValueOnce({ data: { id: 123 }, error: undefined });
		const itemResult = await dataSource.getRule('rule-1');
		expect(itemResult.data).toBeUndefined();
		expect(itemResult.error).toBeInstanceOf(Error);
	});

	it('catches malformed condition metadata responses instead of rejecting', async () => {
		const dataSource = new LeLøginScreenConditionMetadataDataSource(stubHost);
		getConditionMetadataMock.mockResolvedValueOnce({ data: 'bad-metadata', error: undefined });
		const result = await dataSource.getConditionMetadata();
		expect(result.data).toBeUndefined();
		expect(result.error).toBeInstanceOf(Error);
	});
});

describe('asset repository and data source performance (4.7 & 4.8)', () => {
	const rawAsset = {
		id: 'asset-1',
		name: 'Updated',
		kind: 'background',
		storagePath: 'assets/asset-1.jpg',
		width: 800,
		height: 600,
		createdAt: '2026-11-17T00:00:00Z',
		updatedAt: '2026-11-17T00:00:00Z'
	};

	it('requestByUnique fetches a single asset without downloading the full asset list (4.7)', async () => {
		const repo = new LeLøginScreenAssetRepository(stubHost);
		getAssetsByIdMock.mockResolvedValueOnce({ data: rawAsset, error: undefined });

		const result = await repo.requestByUnique('asset-1');

		expect(getAssetsByIdMock).toHaveBeenCalledWith({ path: { id: 'asset-1' } });
		expect(getAssetsMock).not.toHaveBeenCalled();
		expect(result.data?.id).toBe('asset-1');
	});

	it('updateAsset maps the PUT response directly without a follow-up GET (4.8)', async () => {
		const dataSource = new LeLøginScreenAssetDataSource(stubHost);
		putAssetsByIdMock.mockResolvedValueOnce({ data: rawAsset, error: undefined });

		const result = await dataSource.updateAsset('asset-1', {
			name: 'Updated',
			altText: null,
			greetingText: null,
			logoAssetId: null,
			focalPoint: null,
			zoom: null
		});

		expect(putAssetsByIdMock).toHaveBeenCalledTimes(1);
		expect(getAssetsByIdMock).not.toHaveBeenCalled();
		expect(result.data?.name).toBe('Updated');
	});
});
