import type {
	UmbTreeAncestorsOfRequestArgs,
	UmbTreeChildrenOfRequestArgs,
	UmbTreeRootItemsRequestArgs
} from '@umbraco-cms/backoffice/tree';
import {
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
} from './entity-types.js';
import type { LeLøginScreenRuleTreeItemModel } from './types.js';
import type { LeLøginScreenRuleRepository } from './rule.repository.js';

/**
 * The slice of {@link LeLøginScreenRuleRepository} the tree needs. Declared structurally so the
 * tree logic stays free of the backoffice runtime and can be exercised directly in tests.
 */
export type RuleItemsSource = Pick<LeLøginScreenRuleRepository, 'requestItems'>;

type RuleItemsResponse = Awaited<ReturnType<RuleItemsSource['requestItems']>>;
type RuleItemsError = NonNullable<RuleItemsResponse['error']>;

const RULE_ICON = 'icon-autofill';

export interface RuleTreeServerItem {
	id: string;
	name: string;
	hasChildren: boolean;
	icon: string;
}

const toRuleTreeServerItem = (rule: { id: string; name: string }): RuleTreeServerItem => ({
	id: rule.id,
	name: rule.name,
	hasChildren: false,
	icon: RULE_ICON
});

export const toRuleTreeItemModel = (item: RuleTreeServerItem): LeLøginScreenRuleTreeItemModel => ({
	unique: item.id,
	parent: {
		unique: null,
		entityType: LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
	},
	name: item.name,
	entityType: LOGIN_SCREEN_RULE_ENTITY_TYPE,
	hasChildren: false,
	isFolder: false,
	icon: item.icon
});

/**
 * UmbTreeServerDataSourceBase branches on `if (data)` and only falls through to `return { error }`
 * when data is absent. Returning an empty-items envelope alongside an error would therefore
 * present the failure as an empty tree, so a failed read leaves `data` unset entirely.
 */
export interface RuleTreeItemsResult {
	data?: {
		items: RuleTreeServerItem[];
		total: number;
		totalBefore: number;
		totalAfter: number;
	};
	error?: RuleItemsError;
}

export interface RuleTreeAncestorsResult {
	data?: RuleTreeServerItem[];
	error?: RuleItemsError;
}

const itemsResult = (items: RuleTreeServerItem[]): RuleTreeItemsResult => ({
	data: { items, total: items.length, totalBefore: 0, totalAfter: 0 }
});

export const buildDataSourceConfig = (ruleSource: RuleItemsSource) => ({
	getRootItems: async (_args: UmbTreeRootItemsRequestArgs): Promise<RuleTreeItemsResult> => {
		const { data, error } = await ruleSource.requestItems();
		if (error) return { error };
		return itemsResult((data ?? []).map(toRuleTreeServerItem));
	},
	// Rules are leaf nodes — they never have children.
	getChildrenOf: async (_args: UmbTreeChildrenOfRequestArgs): Promise<RuleTreeItemsResult> =>
		itemsResult([]),
	getAncestorsOf: async (args: UmbTreeAncestorsOfRequestArgs): Promise<RuleTreeAncestorsResult> => {
		const { data } = await ruleSource.requestItems();
		const items = (data ?? []).map(toRuleTreeServerItem);
		const currentItem = items.find((item) => item.id === args.treeItem.unique);
		return { data: currentItem === undefined ? [] : [currentItem] };
	},
	mapper: toRuleTreeItemModel
});
