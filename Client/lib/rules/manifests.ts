import {
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE,
} from './entity-types.js';
import { LOGIN_SCREEN_SETTINGS_MENU_ALIAS } from '../section/manifests.ts';
import { createLeLøginScreenManagePermissionCondition } from '../user-permissions/constants.js';

const TREE_ALIAS = 'LeLøgin.Tree.Rules';
const TREE_REPOSITORY_ALIAS = 'LeLøgin.Repository.RuleTree';
const RULE_REPOSITORY_ALIAS = 'LeLøgin.Repository.Rule';
const manageLeLøginScreenCondition = createLeLøginScreenManagePermissionCondition();

const treeRepositoryManifest: UmbExtensionManifest = {
	type: 'repository',
	alias: TREE_REPOSITORY_ALIAS,
	name: 'Login Screen Rule Tree Repository',
	api: () => import('./rule-tree.repository.js'),
	conditions: [manageLeLøginScreenCondition],
};

const ruleRepositoryManifest: UmbExtensionManifest = {
	type: 'repository',
	alias: RULE_REPOSITORY_ALIAS,
	name: 'Login Screen Rule Repository',
	api: () => import('./rule.repository.js'),
	conditions: [manageLeLøginScreenCondition],
};

const treeManifest: UmbExtensionManifest = {
	type: 'tree',
	kind: 'default',
	alias: TREE_ALIAS,
	name: 'Login Screen Rule Tree',
	meta: {
		repositoryAlias: TREE_REPOSITORY_ALIAS,
	},
	conditions: [manageLeLøginScreenCondition],
};

const treeItemManifest: UmbExtensionManifest = {
	type: 'treeItem',
	kind: 'default',
	alias: 'LeLøgin.TreeItem.Rule',
	name: 'Login Screen Rule Tree Item',
	forEntityTypes: [
		LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE,
		LOGIN_SCREEN_RULE_ENTITY_TYPE,
	],
};

const menuItemManifest: UmbExtensionManifest = {
	type: 'menuItem',
	kind: 'tree',
	alias: 'LeLøgin.MenuItem.Rules',
	name: 'Login Screen Rules Menu Item',
	weight: 90,
	meta: {
		label: '#loginScreen_rules',
		icon: 'icon-autofill',
		entityType: LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE,
		menus: [LOGIN_SCREEN_SETTINGS_MENU_ALIAS],
		treeAlias: TREE_ALIAS,
		hideTreeRoot: false,
	},
	conditions: [manageLeLøginScreenCondition],
};

const createRuleActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'create',
	alias: 'LeLøgin.EntityAction.RuleList.Create',
	name: 'Create Login Screen Rule List Entity Action',
	forEntityTypes: [LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE],
	weight: 1200,
	meta: {
		icon: 'icon-add',
		label: '#actions_create',
	},
	conditions: [manageLeLøginScreenCondition],
};

const createRuleOptionManifest: UmbExtensionManifest = {
	type: 'entityCreateOptionAction',
	alias: 'LeLøgin.EntityCreateOptionAction.Rule',
	name: 'Create Login Screen Rule Create Option Action',
	api: () =>
		import('./entity-actions/create-rule-create-option-action.js').then((m) => ({
			api: m.LeLøginScreenCreateRuleCreateOptionAction,
		})),
	forEntityTypes: [LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE],
	weight: 1000,
	meta: {
		icon: 'icon-autofill',
		label: '#loginScreen_createRule',
	},
	conditions: [manageLeLøginScreenCondition],
};

const reloadRulesActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'reloadTreeItemChildren',
	alias: 'LeLøgin.EntityAction.RuleList.Reload',
	name: 'Reload Login Screen Rule Tree Children Entity Action',
	forEntityTypes: [LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE],
	weight: 100,
	meta: {
		icon: 'icon-refresh',
	},
	conditions: [manageLeLøginScreenCondition],
};

const toggleRuleEnabledActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'default',
	alias: 'LeLøgin.EntityAction.Rule.ToggleEnabled',
	name: 'Toggle Login Screen Rule Enabled Entity Action',
	forEntityTypes: [LOGIN_SCREEN_RULE_ENTITY_TYPE],
	weight: 1200,
	element: () => import('./entity-actions/toggle-rule-enabled.element.js'),
	api: () =>
		import('./entity-actions/toggle-rule-enabled-entity-action.js').then((m) => ({
			api: m.LeLøginScreenToggleRuleEnabledEntityAction,
		})),
	meta: {
		icon: 'icon-check',
		label: '#loginScreen_toggleEnabled',
	},
	conditions: [manageLeLøginScreenCondition],
};

const deleteRuleActionManifest: UmbExtensionManifest = {
	type: 'entityAction',
	kind: 'delete',
	alias: 'LeLøgin.EntityAction.Rule.Delete',
	name: 'Delete Login Screen Rule Entity Action',
	forEntityTypes: [LOGIN_SCREEN_RULE_ENTITY_TYPE],
	weight: 1100,
	meta: {
		icon: 'icon-trash',
		label: '#actions_delete',
		itemRepositoryAlias: RULE_REPOSITORY_ALIAS,
		detailRepositoryAlias: RULE_REPOSITORY_ALIAS,
		confirm: {
			headline: '#actions_delete',
			message: '#loginScreen_ruleTreeDeleteMessage',
		},
	},
	conditions: [manageLeLøginScreenCondition],
};

export const manifests: Array<UmbExtensionManifest> = [
	treeRepositoryManifest,
	ruleRepositoryManifest,
	treeManifest,
	treeItemManifest,
	menuItemManifest,
	createRuleActionManifest,
	createRuleOptionManifest,
	reloadRulesActionManifest,
	toggleRuleEnabledActionManifest,
	deleteRuleActionManifest,
];
