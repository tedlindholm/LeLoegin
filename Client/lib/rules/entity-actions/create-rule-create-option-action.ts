import { UmbEntityCreateOptionActionBase } from '@umbraco-cms/backoffice/entity-create-option-action';
import { LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH } from '../entity-types.js';

export class LeLøginScreenCreateRuleCreateOptionAction extends UmbEntityCreateOptionActionBase {
	override async getHref() {
		return LOGIN_SCREEN_RULE_CREATE_WORKSPACE_PATH;
	}
}
