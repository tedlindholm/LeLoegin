import type { UmbTreeItemModel, UmbTreeRootModel } from '@umbraco-cms/backoffice/tree';
import {
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
} from './entity-types.js';

export interface LeLøginScreenRuleTreeItemModel extends UmbTreeItemModel {
	entityType: typeof LOGIN_SCREEN_RULE_ENTITY_TYPE;
}

export interface LeLøginScreenRuleTreeRootModel extends UmbTreeRootModel {
	entityType: typeof LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE;
}
