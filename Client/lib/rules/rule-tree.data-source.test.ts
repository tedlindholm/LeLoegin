import { describe, expect, it } from 'vitest';
import { buildDataSourceConfig, type RuleItemsSource } from './rule-tree.data-source.js';
import { LOGIN_SCREEN_RULE_ENTITY_TYPE } from './entity-types.js';
import type { LoginRule } from '../models/index.js';
import type { LeLøginScreenRuleRepositoryResponse } from './rule.repository.js';

type RuleItemsError = NonNullable<LeLøginScreenRuleRepositoryResponse['error']>;

const apiError = (message: string) => new Error(message) as unknown as RuleItemsError;

const rule = (id: string): LoginRule => ({
	id,
	name: `${id} name`,
	priority: 1,
	enabled: true,
	assetIds: [],
	condition: { operator: 'all', conditions: [] }
});

const createSource = (response: LeLøginScreenRuleRepositoryResponse): RuleItemsSource => ({
	requestItems: async () => response
});

const success = (...rules: LoginRule[]): LeLøginScreenRuleRepositoryResponse => ({
	data: rules,
	error: undefined
});

const failure = (message: string): LeLøginScreenRuleRepositoryResponse => ({
	data: undefined,
	error: apiError(message)
});

const ancestorsArgs = (unique: string) => ({
	treeItem: { unique, entityType: LOGIN_SCREEN_RULE_ENTITY_TYPE }
});

describe('rule tree data source', () => {
	// UmbTreeServerDataSourceBase takes its success branch on any truthy data and drops the error
	// with it, so a failed read must resolve without data.
	it('omits data from getRootItems when the request fails', async () => {
		const config = buildDataSourceConfig(createSource(failure('boom')));

		const result = await config.getRootItems({});

		expect(result.data).toBeUndefined();
		expect(result.error).toBeDefined();
	});

	it('returns rules as root items with paging fields', async () => {
		const config = buildDataSourceConfig(createSource(success(rule('r1'), rule('r2'))));

		const result = await config.getRootItems({});

		expect(result.error).toBeUndefined();
		expect(result.data?.items.map((item) => item.id)).toEqual(['r1', 'r2']);
		expect(result.data?.total).toBe(2);
		expect(result.data?.totalBefore).toBe(0);
		expect(result.data?.totalAfter).toBe(0);
	});

	it('reports rules as childless', async () => {
		const config = buildDataSourceConfig(createSource(success(rule('r1'))));

		const result = await config.getChildrenOf({
			parent: { unique: 'r1', entityType: LOGIN_SCREEN_RULE_ENTITY_TYPE }
		});

		expect(result.error).toBeUndefined();
		expect(result.data?.items).toEqual([]);
		expect(result.data?.total).toBe(0);
	});

	it('resolves a rule to itself as its own ancestor', async () => {
		const config = buildDataSourceConfig(createSource(success(rule('r1'), rule('r2'))));

		const result = await config.getAncestorsOf(ancestorsArgs('r2'));

		expect(result.data?.map((item) => item.id)).toEqual(['r2']);
	});

	it('returns no ancestors for an unknown rule', async () => {
		const config = buildDataSourceConfig(createSource(success(rule('r1'))));

		const result = await config.getAncestorsOf(ancestorsArgs('missing'));

		expect(result.data).toEqual([]);
	});
});
