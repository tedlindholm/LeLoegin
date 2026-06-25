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
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
} from './entity-types.js';
import type { LeLøginScreenRuleTreeItemModel, LeLøginScreenRuleTreeRootModel } from './types.js';
import { LeLøginScreenRuleRepository } from './rule.repository.js';

const RULE_ICON = 'icon-autofill';

interface RuleTreeServerItem {
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

const toRuleTreeItemModel = (item: RuleTreeServerItem): LeLøginScreenRuleTreeItemModel => ({
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

const loadRuleTreeItems = async (
	ruleRepository: LeLøginScreenRuleRepository
): Promise<Array<RuleTreeServerItem>> => {
	const { data } = await ruleRepository.requestItems();
	return (data ?? []).map(toRuleTreeServerItem);
};

const buildDataSourceConfig = (ruleRepository: LeLøginScreenRuleRepository) => ({
	getRootItems: async (_args: UmbTreeRootItemsRequestArgs) => {
		const { data, error } = await ruleRepository.requestItems();
		if (error) {
			return { data: { items: [], total: 0 }, error };
		}
		const items = (data ?? []).map(toRuleTreeServerItem);
		return { data: { items, total: items.length }, error: undefined };
	},
	getChildrenOf: async (_args: UmbTreeChildrenOfRequestArgs) => {
		return { data: { items: [] as Array<RuleTreeServerItem>, total: 0 } };
	},
	getAncestorsOf: async (args: UmbTreeAncestorsOfRequestArgs) => {
		const items = await loadRuleTreeItems(ruleRepository);
		const currentItem = items.find((item) => item.id === args.treeItem.unique);
		return { data: currentItem === undefined ? [] : [currentItem] };
	},
	mapper: toRuleTreeItemModel
});

class RuleTreeDataSource extends UmbTreeServerDataSourceBase<
	RuleTreeServerItem,
	LeLøginScreenRuleTreeItemModel
> {
	constructor(host: UmbControllerHost) {
		super(host, buildDataSourceConfig(new LeLøginScreenRuleRepository(host)));
	}
}

/**
 * Tree repository for login screen rules. Rules are leaf nodes — no children.
 */
export class LeLøginScreenRuleTreeRepository
	extends UmbTreeRepositoryBase<LeLøginScreenRuleTreeItemModel, LeLøginScreenRuleTreeRootModel>
	implements UmbApi
{
	constructor(host: UmbControllerHost) {
		super(host, RuleTreeDataSource);
	}

	async requestTreeRoot() {
		const data: LeLøginScreenRuleTreeRootModel = {
			unique: null,
			entityType: LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE,
			name: '#loginScreen_rules',
			icon: 'icon-autofill',
			hasChildren: true,
			isFolder: true
		};
		return { data };
	}
}

export { LeLøginScreenRuleTreeRepository as api };
