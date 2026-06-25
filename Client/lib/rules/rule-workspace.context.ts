import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbArrayState, UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';
import type { LoginRule } from '../models/index.js';
import { LeLøginScreenRuleRepository } from './rule.repository.js';

export const UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT =
	new UmbContextToken<LeLøginScreenRuleWorkspaceContext>(
		'UmbWorkspaceContext',
		'LeLøgin.WorkspaceContext.Rule'
	);

export class LeLøginScreenRuleWorkspaceContext extends UmbContextBase {
	#repository: LeLøginScreenRuleRepository;
	#rules = new UmbArrayState<LoginRule>([], (rule) => rule.id);
	#isLoading = new UmbBooleanState(false);
	#loadError = new UmbBooleanState(false);

	readonly rules = this.#rules.asObservable();
	readonly isLoading = this.#isLoading.asObservable();
	readonly loadError = this.#loadError.asObservable();

	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT);
		this.#repository = new LeLøginScreenRuleRepository(this);
	}

	async load() {
		this.#isLoading.setValue(true);
		this.#loadError.setValue(false);

		try {
			const { data, error } = await this.#repository.requestItems();
			if (error) {
				console.error('[LeLøginScreen] Failed to load rules', error);
				this.#loadError.setValue(true);
				return { data: undefined, error };
			}

			const rules = data ?? [];
			this.#rules.setValue(rules);
			return { data: rules, error: undefined };
		} finally {
			this.#isLoading.setValue(false);
		}
	}

	async reorder(orderedIds: Array<string>) {
		const byId = new Map(this.#rules.getValue().map((rule) => [rule.id, rule]));
		const reordered: Array<LoginRule> = [];
		for (const id of orderedIds) {
			const rule = byId.get(id);
			if (rule !== undefined) {
				reordered.push(rule);
			}
		}

		const withNewPriorities = reordered.map((rule, index) => ({
			...rule,
			priority: (index + 1) * 100
		}));
		this.#rules.setValue(withNewPriorities);

		const changed = withNewPriorities.filter(
			(rule, index) => rule.priority !== reordered[index]?.priority
		);
		const updates = changed.map((rule) => this.#repository.update(rule.id, rule));
		await Promise.all(updates);
	}

	async toggleEnabled(ruleId: string) {
		const rule = this.#rules.getValue().find((r) => r.id === ruleId);
		if (rule === undefined) return;
		await this.setEnabled(ruleId, !rule.enabled);
	}

	async setEnabled(ruleId: string, enabled: boolean) {
		const rule = this.#rules.getValue().find((candidate) => candidate.id === ruleId);
		if (rule === undefined) {
			return;
		}

		const next = { ...rule, enabled };
		this.#rules.setValue(
			this.#rules.getValue().map((candidate) => (candidate.id === ruleId ? next : candidate))
		);

		const { error } = await this.#repository.update(ruleId, next);
		if (error) {
			console.error('[LeLøginScreen] Failed to update rule enabled state', error);
		}
	}

	async delete(ruleId: string) {
		const { data, error } = await this.#repository.delete(ruleId);
		if (error) {
			console.error('[LeLøginScreen] Failed to delete rule', error);
			return { data: false, error };
		}

		if (data) {
			this.#rules.setValue(this.#rules.getValue().filter((rule) => rule.id !== ruleId));
		}

		return { data, error: undefined };
	}
}

export { LeLøginScreenRuleWorkspaceContext as api };
