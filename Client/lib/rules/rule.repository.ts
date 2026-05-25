import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { LoginRule } from '../models/index.js';
import { LeLøginScreenRuleDataSource } from './rule.data-source.js';

export class LeLøginScreenRuleRepository extends UmbRepositoryBase {
	#dataSource: LeLøginScreenRuleDataSource;

	constructor(host: UmbControllerHost) {
		super(host);
		this.#dataSource = new LeLøginScreenRuleDataSource(this);
	}

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

	async requestByUnique(unique: string) {
		return this.#dataSource.getRule(unique);
	}

	async create(rule: LoginRule) {
		return this.#dataSource.createRule(rule);
	}

	async update(unique: string, rule: LoginRule) {
		return this.#dataSource.updateRule(unique, rule);
	}

	async delete(unique: string) {
		return this.#dataSource.deleteRule(unique);
	}
}

export type LeLøginScreenRuleRepositoryResponse = Awaited<
	ReturnType<LeLøginScreenRuleRepository['requestItems']>
>;

export { LeLøginScreenRuleRepository as api };
