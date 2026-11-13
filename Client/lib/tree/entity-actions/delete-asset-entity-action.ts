import { UmbEntityActionBase, UmbEntityDeletedEvent } from '@umbraco-cms/backoffice/entity-action';
import type { MetaEntityActionDefaultKind } from '@umbraco-cms/backoffice/entity-action';
import { UMB_ACTION_EVENT_CONTEXT } from '@umbraco-cms/backoffice/action';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { umbConfirmModal } from '@umbraco-cms/backoffice/modal';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { escapeHTML } from '@umbraco-cms/backoffice/utils';
import {
	assetDeletionImpact,
	type AssetDeletionImpact
} from '../../assets/asset-deletion-impact.js';
import { LeLøginScreenAssetRepository } from '../../assets/asset.repository.js';
import { LeLøginScreenRuleRepository } from '../../rules/rule.repository.js';
import { requestStructureReload } from '../../utils/request-structure-reload.js';

/**
 * Deletes a login-screen image. Unlike Umbraco's generic delete action, the confirmation names
 * the rules that use the image, and which of them will be disabled because it is their only one,
 * so the change to the login screen is never a surprise.
 */
export class LeLøginScreenDeleteAssetEntityAction extends UmbEntityActionBase<MetaEntityActionDefaultKind> {
	#localize = new UmbLocalizationController(this);

	/**
	 * Loads the asset and the rules that reference it, asks for confirmation, then deletes the
	 * asset. On success it announces the deletion, reloads the surrounding tree structure and
	 * shows a positive notification; on failure it shows a danger notification. Cancelling the
	 * confirmation, or a missing `unique`, does nothing.
	 */
	override async execute() {
		const unique = this.args.unique;
		if (!unique) return;

		const assetRepository = new LeLøginScreenAssetRepository(this);
		const [assetResult, rulesResult] = await Promise.all([
			assetRepository.requestByUnique(unique),
			new LeLøginScreenRuleRepository(this).requestItems()
		]);
		if (assetResult.error || assetResult.data === undefined || rulesResult.error) {
			return;
		}
		const impact = assetDeletionImpact(rulesResult.data ?? [], unique);

		try {
			await umbConfirmModal(this, {
				headline: this.#localize.term('actions_delete'),
				content: this.#confirmationHtml(assetResult.data.name, impact),
				color: 'danger',
				confirmLabel: this.#localize.term('general_delete')
			});
		} catch {
			// Cancelled.
			return;
		}

		const { error } = await assetRepository.delete(unique);
		if (error) {
			return;
		}

		// The same announcements Umbraco's own delete action makes, so trees and lists refresh.
		const actionEventContext = await this.getContext(UMB_ACTION_EVENT_CONTEXT).catch(
			() => undefined
		);
		actionEventContext?.dispatchEvent(
			new UmbEntityDeletedEvent({ unique, entityType: this.args.entityType })
		);
		await requestStructureReload(this, unique, this.args.entityType);
		await this.#notify('positive', 'general_deleted');
	}

	/** The modal renders string content as HTML, so every name is escaped. */
	#confirmationHtml(assetName: string, impact: AssetDeletionImpact): string {
		const paragraphs = [
			this.#localize.term('loginScreen_assetTreeDeleteMessage', escapeHTML(assetName))
		];
		if (impact.reducedRules.length > 0) {
			paragraphs.push(
				this.#localize.term(
					'loginScreen_assetDeleteRulesReduced',
					this.#nameList(impact.reducedRules)
				)
			);
		}
		if (impact.disabledRules.length > 0) {
			paragraphs.push(
				this.#localize.term(
					'loginScreen_assetDeleteRulesDisabled',
					this.#nameList(impact.disabledRules)
				)
			);
		}
		return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
	}

	#nameList(names: ReadonlyArray<string>): string {
		return names.map((name) => `<strong>${escapeHTML(name)}</strong>`).join(', ');
	}

	async #notify(color: 'positive' | 'danger', term: string) {
		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT).catch(
			() => undefined
		);
		notificationContext?.peek(color, { data: { message: this.#localize.term(term) } });
	}
}

/** Exported as `api` so the manifest's lazy import resolves the action. */
export { LeLøginScreenDeleteAssetEntityAction as api };
