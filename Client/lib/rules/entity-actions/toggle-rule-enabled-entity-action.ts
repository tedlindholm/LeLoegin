import { UmbEntityActionBase } from '@umbraco-cms/backoffice/entity-action';
import type { MetaEntityActionDefaultKind } from '@umbraco-cms/backoffice/entity-action';
import { UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT } from '../../workspaces/rule-editor-workspace.context.js';
import { UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT } from '../rule-workspace.context.js';
import { LeLøginScreenRuleRepository } from '../rule.repository.js';

export class LeLøginScreenToggleRuleEnabledEntityAction extends UmbEntityActionBase<MetaEntityActionDefaultKind> {
	override async execute() {
		const unique = this.args.unique;
		if (!unique) return;

		try {
			const ctx = await this.getContext(UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT);
			if (ctx !== undefined) {
				const draft = ctx.getDraft();
				if (draft === null) return;
				ctx.updateDraft({ enabled: !draft.enabled });
				await ctx.requestSubmit();
				return;
			}
		} catch {
			// editor context not in scope
		}

		try {
			const listCtx = await this.getContext(UMB_LOGIN_SCREEN_RULE_WORKSPACE_CONTEXT);
			if (listCtx !== undefined) {
				await listCtx.toggleEnabled(unique);
				return;
			}
		} catch {
			// list context not in scope either
		}

		const repo = new LeLøginScreenRuleRepository(this);
		const { data } = await repo.requestByUnique(unique);
		if (data === undefined) return;
		await repo.update(unique, { ...data, enabled: !data.enabled });
	}
}

export { LeLøginScreenToggleRuleEnabledEntityAction as api };
