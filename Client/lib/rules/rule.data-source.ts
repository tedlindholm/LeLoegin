import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { V1 } from '../api/index.js';
import { mapApiLoginRule, mapApiLoginRules, toSaveRuleRequest } from '../models/api-adapters.js';
import type { LoginRule } from '../models/index.js';

export class LeLøginScreenRuleDataSource extends UmbControllerBase {
	constructor(host: UmbControllerHost) {
		super(host);
	}

	async getRules() {
		const { data, error } = await tryExecute(this, V1.getRules());
		return {
			data: data === undefined ? undefined : mapApiLoginRules(data),
			error
		};
	}

	async getRule(ruleId: string) {
		const { data, error } = await tryExecute(
			this,
			V1.getRulesById({ path: { id: ruleId } })
		);
		return {
			data: data === undefined ? undefined : mapApiLoginRule(data),
			error
		};
	}

	async createRule(rule: LoginRule) {
		const { data, error } = await tryExecute(
			this,
			V1.postRules({ body: toSaveRuleRequest(rule) })
		);
		return {
			data: data === undefined ? undefined : mapApiLoginRule(data),
			error
		};
	}

	async updateRule(ruleId: string, rule: LoginRule) {
		const { data, error } = await tryExecute(
			this,
			V1.putRulesById({ path: { id: ruleId }, body: toSaveRuleRequest(rule) })
		);
		return {
			data: data === undefined ? undefined : mapApiLoginRule(data),
			error
		};
	}

	async deleteRule(ruleId: string) {
		const { error } = await tryExecute(
			this,
			V1.deleteRulesById({ path: { id: ruleId } })
		);
		return {
			data: error ? false : true,
			error
		};
	}
}
