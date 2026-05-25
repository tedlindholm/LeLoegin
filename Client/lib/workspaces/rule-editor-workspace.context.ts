import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbArrayState, UmbBooleanState, UmbObjectState, UmbStringState } from '@umbraco-cms/backoffice/observable-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbStateManager } from '@umbraco-cms/backoffice/utils';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { LoginImageAsset, LoginRule } from '../models/index.js';
import { LeLøginScreenConditionMetadataDataSource } from '../rules/condition-metadata.data-source.js';
import { createEmptyRuleConditionGroup } from '../rules/rule-condition.js';
import type { ConditionMetadata, LoginRuleConditionGroup } from '../rules/rule-condition.js';
import { buildRuleWorkspacePath, LOGIN_SCREEN_RULE_ENTITY_TYPE, LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE } from '../rules/entity-types.js';
import { LeLøginScreenRuleRepository } from '../rules/rule.repository.js';

const LOGIN_SCREEN_RULE_WORKSPACE_ALIAS = 'LeLøgin.Workspace.Rule';

export interface LoginRuleDraft {
	id?: string;
	name: string;
	priority: number;
	enabled: boolean;
	assetId: string;
	condition: LoginRuleConditionGroup;
}

type ValidationState = 'nameRequired' | 'assetRequired' | 'conditionValueRequired';
const VALIDATION_TERMS: Record<ValidationState, string> = {
	nameRequired: 'loginScreen_validationRuleName',
	assetRequired: 'loginScreen_validationRuleAsset',
	conditionValueRequired: 'loginScreen_validationConditionValue',
};

export const UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT =
	new UmbContextToken<UmbWorkspaceContext, LeLøginScreenRuleEditorWorkspaceContext>(
		'UmbWorkspaceContext',
		undefined,
		(context): context is LeLøginScreenRuleEditorWorkspaceContext =>
			context.getEntityType?.() === LOGIN_SCREEN_RULE_ENTITY_TYPE
	);

export class LeLøginScreenRuleEditorWorkspaceContext extends UmbContextBase {
	readonly workspaceAlias = LOGIN_SCREEN_RULE_WORKSPACE_ALIAS;
	readonly routes = new UmbWorkspaceRouteManager(this);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly IS_ENTITY_DETAIL_WORKSPACE_CONTEXT = true;
	readonly loading = new UmbStateManager(this);
	readonly forbidden = new UmbStateManager(this);

	#ruleRepository: LeLøginScreenRuleRepository;
	#assetRepository: LeLøginScreenAssetRepository;
	#conditionMetadataDataSource: LeLøginScreenConditionMetadataDataSource;
	#currentRule = new UmbObjectState<LoginRuleDraft | null>(null);
	#assets = new UmbArrayState<LoginImageAsset>([], (asset) => asset.id);
	#conditionMetadata = new UmbObjectState<ConditionMetadata | null>(null);
	#isLoading = new UmbBooleanState(false);
	#name = new UmbStringState('');
	#unique = new UmbObjectState<string | undefined>(undefined);
	#entityType = new UmbStringState(LOGIN_SCREEN_RULE_ENTITY_TYPE);
	#isNew = new UmbBooleanState(false);
	#createUnderParent = new UmbObjectState<UmbEntityModel | undefined>(undefined);
	#draft: LoginRuleDraft | null = null;
	#localize = new UmbLocalizationController(this);

	readonly currentRule = this.#currentRule.asObservable();
	readonly data = this.#currentRule.asObservable();
	readonly assets = this.#assets.asObservable();
	readonly conditionMetadata = this.#conditionMetadata.asObservable();
	readonly isLoading = this.#isLoading.asObservable();
	readonly name = this.#name.asObservable();
	readonly unique = this.#unique.asObservable();
	readonly entityType = this.#entityType.asObservable();
	readonly isNew = this.#isNew.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParent = this.#createUnderParent.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityUnique = this.#createUnderParent.asObservablePart((p) => p?.unique);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityType = this.#createUnderParent.asObservablePart((p) => p?.entityType);

	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT);
		this.#ruleRepository = new LeLøginScreenRuleRepository(this);
		this.#assetRepository = new LeLøginScreenAssetRepository(this);
		this.#conditionMetadataDataSource = new LeLøginScreenConditionMetadataDataSource(this);
		this.#createUnderParent.setValue({ unique: null, entityType: LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE });
		this.routes.setRoutes([
			{
				path: 'create',
				component: () => import('./rule-workspace.element.js'),
				setup: async () => {
					this.#unique.setValue(globalThis.crypto.randomUUID());
					this.#isNew.setValue(true);
					await Promise.all([this.loadAssets(), this.loadConditionMetadata()]);
					const draft = this.#createEmptyDraft();
					this.#currentRule.setValue(draft);
					this.#draft = this.#cloneDraft(draft);
					this.#name.setValue(draft.name);
				},
			},
			{
				path: 'edit/:unique',
				component: () => import('./rule-workspace.element.js'),
				setup: async (_component, info) => {
					const unique = info.match.params.unique;
					if (unique === undefined) {
						this.#currentRule.setValue(null);
						this.#draft = null;
						this.#name.setValue('');
						this.#unique.setValue(undefined);
						this.#isNew.setValue(false);
						return;
					}
					this.#unique.setValue(unique);
					this.#isNew.setValue(false);
					await Promise.all([this.loadAssets(), this.loadConditionMetadata(), this.loadRule(unique)]);
				},
			},
		]);
	}

	getEntityType() { return LOGIN_SCREEN_RULE_ENTITY_TYPE; }
	getUnique() { return this.#unique.getValue(); }
	getName(): string { return this.#name.getValue(); }
	setName(name: string) { this.updateDraft({ name }); }
	getIsNew(): boolean { return this.#isNew.getValue(); }
	getDraft(): LoginRuleDraft | null { return this.#draft === null ? null : this.#cloneDraft(this.#draft); }

	async loadAssets() {
		const { data, error } = await this.#assetRepository.requestItems();
		if (error) { console.error('[LeLøginScreen] Failed to load assets for rule editor', error); return { data: undefined, error }; }
		const assets = data ?? [];
		this.#assets.setValue(assets);
		return { data: assets, error: undefined };
	}

	async loadConditionMetadata() {
		const { data, error } = await this.#conditionMetadataDataSource.getConditionMetadata();
		if (error) { console.error('[LeLøginScreen] Failed to load condition metadata', error); return { data: undefined, error }; }
		this.#conditionMetadata.setValue(data ?? null);
		return { data, error: undefined };
	}

	async loadRule(ruleId: string) {
		this.#isLoading.setValue(true);
		if (!this.loading.getStates().some((s) => s.unique === 'loading')) {
			this.loading.addState({ unique: 'loading', message: 'Loading rule' });
		}
		this.#unique.setValue(ruleId);
		try {
			const { data, error } = await this.#ruleRepository.requestByUnique(ruleId);
			if (error) { console.error('[LeLøginScreen] Failed to load rule', error); return { data: undefined, error }; }
			const draft = data === undefined ? null : this.#toDraft(data);
			this.#currentRule.setValue(draft);
			this.#draft = draft === null ? null : this.#cloneDraft(draft);
			this.#name.setValue(draft?.name ?? '');
			return { data: draft, error: undefined };
		} finally {
			this.#isLoading.setValue(false);
			this.loading.removeState('loading');
		}
	}

	updateDraft(update: Partial<LoginRuleDraft>) {
		if (this.#draft === null) return;
		this.#draft = { ...this.#draft, ...update };
		if (update.name !== undefined) this.#name.setValue(update.name);
	}

	async requestSubmit() {
		if (this.#draft === null) return false;
		const validationState = this.#validateDraft(this.#draft);
		if (validationState !== undefined) {
			await this.#notify('danger', this.#localize.term(VALIDATION_TERMS[validationState]));
			return false;
		}
		const wasNew = this.#draft.id === undefined;
		const { data, error } = await this.#saveRule(this.#draft);
		if (error || data === undefined) {
			await this.#notify('danger', this.#localize.term('loginScreen_ruleSaveFailed'));
			return false;
		}
		await this.#notify('positive', this.#localize.term(wasNew ? 'loginScreen_ruleCreated' : 'loginScreen_ruleSaved'));
		return true;
	}

	async #notify(color: 'positive' | 'danger', message: string) {
		const ctx = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		ctx?.peek(color, { data: { message } });
	}

	async #saveRule(draft: LoginRuleDraft) {
		this.#isLoading.setValue(true);
		const rule: LoginRule = { id: draft.id ?? globalThis.crypto.randomUUID(), name: draft.name, priority: draft.priority, enabled: draft.enabled, assetId: draft.assetId, condition: draft.condition };
		try {
			const response = draft.id === undefined
				? await this.#ruleRepository.create(rule)
				: await this.#ruleRepository.update(draft.id, rule);
			const { data, error } = response;
			if (error) { console.error('[LeLøginScreen] Failed to save rule', error); return { data: undefined, error }; }
			if (data !== undefined) {
				const saved = this.#toDraft(data);
				this.#currentRule.setValue(saved);
				this.#draft = this.#cloneDraft(saved);
				this.#name.setValue(saved.name);
				this.#unique.setValue(data.id);
				this.#isNew.setValue(false);
				if (draft.id === undefined) window.history.replaceState(null, '', buildRuleWorkspacePath(data.id));
			}
			return { data: data === undefined ? undefined : this.#toDraft(data), error: undefined };
		} finally {
			this.#isLoading.setValue(false);
		}
	}

	async deleteRule(ruleId: string) {
		const { data, error } = await this.#ruleRepository.delete(ruleId);
		if (error) { console.error('[LeLøginScreen] Failed to delete rule', error); return { data: false, error }; }
		if (data) { this.#currentRule.setValue(null); this.#draft = null; }
		return { data, error: undefined };
	}

	#validateDraft(draft: LoginRuleDraft): ValidationState | undefined {
		if (draft.name.trim().length === 0) return 'nameRequired';
		if (draft.assetId.trim().length === 0) return 'assetRequired';
		for (const condition of draft.condition.conditions) {
			if (condition.values.length === 0 || condition.values.some(
				(v) => (typeof v === 'string' && v.trim().length === 0) || (typeof v === 'number' && Number.isNaN(v))
			)) return 'conditionValueRequired';
		}
		return undefined;
	}

	#createEmptyDraft(): LoginRuleDraft {
		const metadata = this.#conditionMetadata.getValue();
		return { name: '', priority: 100, enabled: true, assetId: '', condition: metadata !== null ? createEmptyRuleConditionGroup(metadata) : { operator: 'all', conditions: [] } };
	}

	#toDraft(rule: LoginRule): LoginRuleDraft {
		return {
			id: rule.id, name: rule.name, priority: rule.priority, enabled: rule.enabled, assetId: rule.assetId,
			condition: { operator: rule.condition.operator, conditions: rule.condition.conditions.map((c) => ({ ...c, values: [...c.values] })) },
		};
	}

	#cloneDraft(draft: LoginRuleDraft): LoginRuleDraft {
		return {
			...(draft.id === undefined ? {} : { id: draft.id }), name: draft.name, priority: draft.priority, enabled: draft.enabled, assetId: draft.assetId,
			condition: { operator: draft.condition.operator, conditions: draft.condition.conditions.map((c) => ({ ...c, values: [...c.values] })) },
		};
	}
}

export { LeLøginScreenRuleEditorWorkspaceContext as api };
