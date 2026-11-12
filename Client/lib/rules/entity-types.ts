/** Entity type of the rule list, the root of the rules tree. */
export const LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE = 'login-screen-rule-list';
/** Entity type of a single login-screen rule. */
export const LOGIN_SCREEN_RULE_ENTITY_TYPE = 'login-screen-rule';

/** Backoffice URL of the rule list workspace in the Settings section. */
export const LOGIN_SCREEN_RULE_LIST_WORKSPACE_PATH =
	'/umbraco/section/settings/workspace/login-screen-rule-list/edit/null';
/** Backoffice URL of the rule workspace in create mode. */
export const LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH =
	'/umbraco/section/settings/workspace/login-screen-rule/create';

/**
 * Builds the backoffice URL that opens an existing rule in the rule workspace.
 *
 * @param ruleId - Identifier of the rule; URI-encoded into the path
 * @returns The rule's edit workspace path
 */
export const buildRuleWorkspacePath = (ruleId: string): string => {
	return `/umbraco/section/settings/workspace/login-screen-rule/edit/${encodeURIComponent(ruleId)}`;
};
