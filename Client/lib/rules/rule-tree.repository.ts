import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { UmbApi } from '@umbraco-cms/backoffice/extension-api';
import { UmbTreeRepositoryBase, UmbTreeServerDataSourceBase } from '@umbraco-cms/backoffice/tree';
import { LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE } from './entity-types.js';
import type { LeLøginScreenRuleTreeItemModel, LeLøginScreenRuleTreeRootModel } from './types.js';
import { buildDataSourceConfig, type RuleTreeServerItem } from './rule-tree.data-source.js';
import { LeLøginScreenRuleRepository } from './rule.repository.js';

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
