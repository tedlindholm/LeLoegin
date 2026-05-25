export const LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE = 'login-screen-rule-list';
export const LOGIN_SCREEN_RULE_ENTITY_TYPE = 'login-screen-rule';

export const LOGIN_SCREEN_RULE_LIST_WORKSPACE_PATH =
	'/umbraco/section/settings/workspace/login-screen-rule-list/edit/null';
export const LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH =
	'/umbraco/section/settings/workspace/login-screen-rule/create';

export const buildRuleWorkspacePath = (ruleId: string): string => {
	return `/umbraco/section/settings/workspace/login-screen-rule/edit/${encodeURIComponent(ruleId)}`;
};
