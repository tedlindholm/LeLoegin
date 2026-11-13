import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssetsMock, getAssetsByIdMock, getRulesMock, getRulesByIdMock, getConditionMetadataMock } =
	vi.hoisted(() => ({
		getAssetsMock: vi.fn(),
		getAssetsByIdMock: vi.fn(),
		getRulesMock: vi.fn(),
		getRulesByIdMock: vi.fn(),
		getConditionMetadataMock: vi.fn()
	}));

vi.mock('@umbraco-cms/backoffice/class-api', () => ({
	UmbControllerBase: class {}
}));

vi.mock('@umbraco-cms/backoffice/resources', () => ({
	tryExecute: async (_host: unknown, request: Promise<unknown>) => await request
}));

vi.mock('../api/index.js', () => ({
	V1: {
		getAssets: getAssetsMock,
		getAssetsById: getAssetsByIdMock,
		getRules: getRulesMock,
		getRulesById: getRulesByIdMock,
		getRulesConditionMetadata: getConditionMetadataMock
	}
}));

import { LeLøginScreenAssetDataSource } from '../assets/asset.data-source.js';
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

