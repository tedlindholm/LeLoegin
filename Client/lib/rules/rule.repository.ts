import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { LoginRule } from '../models/index.js';
import { LeLøginScreenRuleDataSource } from './rule.data-source.js';

/**
 * Repository for login-screen rules (`LeLøgin.Repository.Rule`). Wraps
 * {@link LeLøginScreenRuleDataSource} and passes its `{ data, error }` results through unchanged.
 */
export class LeLøginScreenRuleRepository extends UmbRepositoryBase {
	#dataSource: LeLøginScreenRuleDataSource;

	constructor(host: UmbControllerHost) {
		super(host);
		this.#dataSource = new LeLøginScreenRuleDataSource(this);
	}

	/**
	 * Requests rules. The server returns every rule; filtering by `uniques` happens client-side.
	 *
	 * @param uniques - Rule identifiers to keep; omit to return every rule
	 * @returns The matching rules, or the request error
	 */
	async requestItems(uniques?: string[]) {
		const { data, error } = await this.#dataSource.getRules();

		if (uniques === undefined) {
			return { data, error };
		}

		return {
			data: data?.filter((rule) => uniques.includes(rule.id)),
			error
		};
	}

	/**
	 * Requests a single rule.
	 *
	 * @param unique - Identifier of the rule
	 * @returns The rule, or the request error
	 */
	async requestByUnique(unique: string) {
		return this.#dataSource.getRule(unique);
	}

	/**
	 * Creates a rule.
	 *
	 * @param rule - The rule to save
	 * @returns The saved rule, or the request error
	 */
	async create(rule: LoginRule) {
		return this.#dataSource.createRule(rule);
	}

	/**
	 * Replaces an existing rule.
	 *
	 * @param unique - Identifier of the rule to update
	 * @param rule - The full rule to save
	 * @returns The saved rule, or the request error
	 */
	async update(unique: string, rule: LoginRule) {
		return this.#dataSource.updateRule(unique, rule);
	}

	/**
	 * Deletes a rule.
	 *
	 * @param unique - Identifier of the rule to delete
	 * @returns `data: true` when deleted, otherwise `false` with the request error
	 */
	async delete(unique: string) {
		return this.#dataSource.deleteRule(unique);
	}
}

/** Result shape of {@link LeLøginScreenRuleRepository.requestItems}. */
export type LeLøginScreenRuleRepositoryResponse = Awaited<
	ReturnType<LeLøginScreenRuleRepository['requestItems']>
>;

export { LeLøginScreenRuleRepository as api };
