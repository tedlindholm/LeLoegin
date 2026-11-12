import { UmbEntityActionBase } from '@umbraco-cms/backoffice/entity-action';
import type { MetaEntityActionDefaultKind } from '@umbraco-cms/backoffice/entity-action';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT } from '../../workspaces/rule-editor-workspace.context.js';
import { requestStructureReload } from '../../utils/request-structure-reload.js';
import { UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT } from '../rule-workspace.context.js';
import { LeLøginScreenRuleRepository } from '../rule.repository.js';

/**
 * Enables or disables a rule. Only the saved rule's `enabled` flag changes: unsaved edits in an
 * open rule editor are neither saved nor discarded.
 */
export class LeLøginScreenToggleRuleEnabledEntityAction extends UmbEntityActionBase<MetaEntityActionDefaultKind> {
	#localize = new UmbLocalizationController(this);

	/**
	 * Reads the saved rule, saves it with `enabled` flipped and shows a success or failure
	 * notification. After a successful save, updates any open rule editor and rule list and
	 * reloads the tree structure. Does nothing when the action has no unique.
	 */
	override async execute() {
		const unique = this.args.unique;
		if (!unique) return;

		const repository = new LeLøginScreenRuleRepository(this);
		const { data: rule } = await repository.requestByUnique(unique);
		const enabled = rule === undefined ? undefined : !rule.enabled;
		const saved =
			rule !== undefined && enabled !== undefined
				? (await repository.update(unique, { ...rule, enabled })).error === undefined
				: false;

		await this.#notify(saved);
		if (!saved || enabled === undefined) return;

		// The rule editor and rule list are only in scope when the action runs from them.
		const editor = await this.getContext(UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT).catch(
			() => undefined
		);
		editor?.applySavedEnabled(unique, enabled);
		const list = await this.getContext(UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT).catch(
			() => undefined
		);
		await list?.load();
		await requestStructureReload(this, unique, this.args.entityType);
	}

	async #notify(saved: boolean) {
		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT).catch(
			() => undefined
		);
		notificationContext?.peek(saved ? 'positive' : 'danger', {
			data: {
				message: this.#localize.term(saved ? 'loginScreen_ruleSaved' : 'loginScreen_ruleSaveFailed')
			}
		});
	}
}

export { LeLøginScreenToggleRuleEnabledEntityAction as api };
