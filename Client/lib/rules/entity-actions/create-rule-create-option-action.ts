import { UmbEntityCreateOptionActionBase } from '@umbraco-cms/backoffice/entity-create-option-action';
import { LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH } from '../entity-types.js';

/** Create option that opens the rule workspace in create mode. */
export class LeLøginScreenCreateRuleCreateOptionAction extends UmbEntityCreateOptionActionBase {
	/**
	 * Gets the link target for the create option.
	 *
	 * @returns The rule create workspace path
	 */
	override async getHref() {
		return LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH;
	}
}
