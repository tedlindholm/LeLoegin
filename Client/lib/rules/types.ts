import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import {
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
} from './entity-types.js';

/** Tree item for a single rule in the Le Løgin rules tree. Rules are always leaf nodes. */
export interface LeLøginScreenRuleTreeItemModel extends UmbTreeItemModel {
	/** Narrowed to the rule entity type. */
	entityType: typeof LOGIN_SCREEN_RULE_ENTITY_TYPE;
}

/** Root node of the Le Løgin rules tree, representing the rule list. */
export interface LeLøginScreenRuleTreeRootModel extends UmbTreeRootModel {
	/** Narrowed to the rule list entity type. */
	entityType: typeof LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE;
}
