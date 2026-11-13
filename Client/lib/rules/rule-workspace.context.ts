import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbArrayState, UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';
import type { LoginRule } from '../models/index.js';
import { LeLøginScreenRuleRepository } from './rule.repository.js';
import { requestStructureReload } from '../utils/request-structure-reload.js';
import { LOGIN_SCREEN_RULE_ENTITY_TYPE } from './entity-types.js';

/** Context token for the rule list workspace context. */
export const UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT =
	new UmbContextToken<LeLøginScreenRuleWorkspaceContext>(
		'UmbWorkspaceContext',
		'LeLøgin.WorkspaceContext.Rule'
	);

/**
 * Workspace context for the rule list. Holds the loaded rules and applies reorder, enable and
 * delete changes optimistically; when a save fails it reloads from the server and shows a
 * danger notification.
 */
export class LeLøginScreenRuleWorkspaceContext extends UmbContextBase {
	#repository: LeLøginScreenRuleRepository;
	#rules = new UmbArrayState<LoginRule>([], (rule) => rule.id);
	#isLoading = new UmbBooleanState(false);
	#loadError = new UmbBooleanState(false);

	/** The rules in priority order. */
	readonly rules = this.#rules.asObservable();
	/** Whether a load is in progress. */
	readonly isLoading = this.#isLoading.asObservable();
	/** Whether the last load failed. */
	readonly loadError = this.#loadError.asObservable();

	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT);
		this.#repository = new LeLøginScreenRuleRepository(this);
	}

	/**
	 * Loads every rule from the server into {@link rules}. On failure the previous rules are kept
	 * and {@link loadError} is set.
	 *
	 * @returns The loaded rules, or the request error
	 */
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

	/**
	 * Reorders the rules and reassigns priorities in steps of 100. Only rules whose priority
	 * changed are saved. Unknown ids are ignored, and rules missing from `orderedIds` are dropped
	 * from the local list.
	 *
	 * @param orderedIds - Rule identifiers in their new order
	 */
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
		const results = await Promise.all(
			changed.map((rule) => this.#updateWithLatest(rule.id, (latest) => ({ ...latest, priority: rule.priority })))
		);
		if (results.some((result) => result.error !== undefined)) {
			await this.#recoverFromFailedSave();
		}
	}

	/**
	 * Flips a rule's enabled state. Does nothing when the rule is not loaded.
	 *
	 * @param ruleId - Identifier of the rule
	 */
	async toggleEnabled(ruleId: string) {
		const rule = this.#rules.getValue().find((r) => r.id === ruleId);
		if (rule === undefined) return;
		await this.setEnabled(ruleId, !rule.enabled);
	}

	/**
	 * Sets a rule's enabled state and saves it. Does nothing when the rule is not loaded.
	 *
	 * @param ruleId - Identifier of the rule
	 * @param enabled - The new enabled state
	 */
	async setEnabled(ruleId: string, enabled: boolean) {
		const rule = this.#rules.getValue().find((candidate) => candidate.id === ruleId);
		if (rule === undefined) {
			return;
		}

		const next = { ...rule, enabled };
		this.#rules.setValue(
			this.#rules.getValue().map((candidate) => (candidate.id === ruleId ? next : candidate))
		);

		const { error } = await this.#updateWithLatest(ruleId, (latest) => ({ ...latest, enabled }));
		if (error) {
			console.error('[LeLøginScreen] Failed to update rule enabled state', error);
			await this.#recoverFromFailedSave();
		}
	}

	async #updateWithLatest(ruleId: string, apply: (latest: LoginRule) => LoginRule) {
		const { data: latest, error: readError } = await this.#repository.requestByUnique(ruleId);
		if (readError || latest === undefined) {
			return { data: undefined, error: readError ?? new Error('Rule not found.') };
		}
		return this.#repository.update(ruleId, apply(latest));
	}

	/**
	 * Deletes a rule, removes it from the list and reloads the tree structure.
	 *
	 * @param ruleId - Identifier of the rule to delete
	 * @returns `data: true` when deleted, otherwise `false` with the request error
	 */
	async delete(ruleId: string) {
		const { data, error } = await this.#repository.delete(ruleId);
		if (error) {
			console.error('[LeLøginScreen] Failed to delete rule', error);
			return { data: false, error };
		}

		if (data) {
			this.#rules.setValue(this.#rules.getValue().filter((rule) => rule.id !== ruleId));
			await requestStructureReload(this, ruleId, LOGIN_SCREEN_RULE_ENTITY_TYPE);
		}

		return { data, error: undefined };
	}

	/**
	 * The list was updated before the server answered. After a failure, reload it so it shows
	 * what was actually saved — a reorder may have saved some rules and not others. `tryExecute`
	 * already shows the HTTP error notification.
	 */
	async #recoverFromFailedSave() {
		await this.load();
	}
}

export { LeLøginScreenRuleWorkspaceContext as api };
