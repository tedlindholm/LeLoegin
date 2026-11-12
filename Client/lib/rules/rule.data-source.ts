import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { V1 } from '../api/index.js';
import { mapApiLoginRule, mapApiLoginRules, toSaveRuleRequest } from '../models/api-adapters.js';
import type { LoginRule } from '../models/index.js';

/**
 * Data source for the Le Løgin rule management endpoints. Calls the generated OpenAPI client and
 * maps API models to {@link LoginRule}. Every method returns `{ data, error }`; `data` is
 * `undefined` (or `false` for deletes) when the request fails.
 */
export class LeLøginScreenRuleDataSource extends UmbControllerBase {
	constructor(host: UmbControllerHost) {
		super(host);
	}

	/**
	 * Fetches every rule.
	 *
	 * @returns All rules, or the request error
	 */
	async getRules() {
		const { data, error } = await tryExecute(this, V1.getRules());
		return {
			data: data === undefined ? undefined : mapApiLoginRules(data),
			error
		};
	}

	/**
	 * Fetches one rule.
	 *
	 * @param ruleId - Identifier of the rule
	 * @returns The rule, or the request error
	 */
	async getRule(ruleId: string) {
		const { data, error } = await tryExecute(this, V1.getRulesById({ path: { id: ruleId } }));
		return {
			data: data === undefined ? undefined : mapApiLoginRule(data),
			error
		};
	}

	/**
	 * Creates a rule on the server.
	 *
	 * @param rule - The rule to save
	 * @returns The rule as saved by the server, or the request error
	 */
	async createRule(rule: LoginRule) {
		const { data, error } = await tryExecute(this, V1.postRules({ body: toSaveRuleRequest(rule) }));
		return {
			data: data === undefined ? undefined : mapApiLoginRule(data),
			error
		};
	}

	/**
	 * Replaces an existing rule on the server.
	 *
	 * @param ruleId - Identifier of the rule to update
	 * @param rule - The full rule to save
	 * @returns The rule as saved by the server, or the request error
	 */
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

	/**
	 * Deletes a rule on the server.
	 *
	 * @param ruleId - Identifier of the rule to delete
	 * @returns `data: true` when deleted, otherwise `false` with the request error
	 */
	async deleteRule(ruleId: string) {
		const { error } = await tryExecute(this, V1.deleteRulesById({ path: { id: ruleId } }));
		return {
			data: error ? false : true,
			error
		};
	}
}
