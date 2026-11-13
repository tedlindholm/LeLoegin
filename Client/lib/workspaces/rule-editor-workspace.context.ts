import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import {
	UmbArrayState,
	UmbBooleanState,
	UmbObjectState,
	UmbStringState
} from '@umbraco-cms/backoffice/observable-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import type { UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbStateManager } from '@umbraco-cms/backoffice/utils';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { LoginImageAsset } from '../models/index.js';
import { LeLøginScreenConditionMetadataDataSource } from '../rules/condition-metadata.data-source.js';
import type { ConditionMetadata } from '../rules/rule-condition.js';
import {
	buildRuleWorkspacePath,
	LOGIN_SCREEN_RULE_ENTITY_TYPE,
	LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
} from '../rules/entity-types.js';
import { LeLøginScreenRuleRepository } from '../rules/rule.repository.js';
import { LatestLoad } from '../utils/latest-load.js';
import {
	requestChildrenReload,
	requestStructureReload
} from '../utils/request-structure-reload.js';
import {
	cloneRuleDraft,
	createEmptyRuleDraft,
	draftToRule,
	ruleToDraft,
	RULE_DRAFT_VALIDATION_TERMS,
	validateRuleDraft,
	type LoginRuleDraft
} from './rule-draft.js';

const LOGIN_SCREEN_RULE_WORKSPACE_ALIAS = 'LeLøgin.Workspace.Rule';

/** Context token for the rule editor workspace; matches only a workspace context for a rule. */
export const UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbWorkspaceContext,
	LeLøginScreenRuleEditorWorkspaceContext
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is LeLøginScreenRuleEditorWorkspaceContext =>
		context.getEntityType?.() === LOGIN_SCREEN_RULE_ENTITY_TYPE
);

/**
 * Routable workspace context for creating and editing a rule. Serves `create` and
 * `edit/:unique`, loads the assets and condition metadata the editor needs, keeps an editable
 * draft separate from the saved rule, and validates and saves it.
 */
export class LeLøginScreenRuleEditorWorkspaceContext extends UmbContextBase {
	/** Alias of the workspace manifest this context belongs to. */
	readonly workspaceAlias = LOGIN_SCREEN_RULE_WORKSPACE_ALIAS;
	/** Workspace routes; serves `create` and `edit/:unique`. */
	readonly routes = new UmbWorkspaceRouteManager(this);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly IS_ENTITY_DETAIL_WORKSPACE_CONTEXT = true;
	/** Loading states the workspace editor shows; holds one entry while a rule loads. */
	readonly loading = new UmbStateManager(this);
	/** Forbidden states the workspace editor reads; Le Løgin adds none. */
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
	#loads = new LatestLoad();
	#localize = new UmbLocalizationController(this);

	/** The rule as last loaded or saved (a fresh draft when creating), or `null` while loading. */
	readonly currentRule = this.#currentRule.asObservable();
	/** Same as `currentRule`; the name Umbraco's workspace editor observes. */
	readonly data = this.#currentRule.asObservable();
	/** Every asset, offered as images the rule can show. */
	readonly assets = this.#assets.asObservable();
	/** Condition types and options for the condition editor, or `null` until loaded. */
	readonly conditionMetadata = this.#conditionMetadata.asObservable();
	/** True while a rule loads or saves. */
	readonly isLoading = this.#isLoading.asObservable();
	/** The draft's name, shown in the workspace header. */
	readonly name = this.#name.asObservable();
	/** Id of the rule; a draft id while creating. */
	readonly unique = this.#unique.asObservable();
	/** Always the rule entity type. */
	readonly entityType = this.#entityType.asObservable();
	/** True until a new rule is first saved. */
	readonly isNew = this.#isNew.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParent = this.#createUnderParent.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityUnique = this.#createUnderParent.asObservablePart(
		(p) => p?.unique
	);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityType = this.#createUnderParent.asObservablePart(
		(p) => p?.entityType
	);

	/**
	 * Provides the context and registers the create and edit routes.
	 *
	 * @param host - The workspace's controller host.
	 */
	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT);
		this.#ruleRepository = new LeLøginScreenRuleRepository(this);
		this.#assetRepository = new LeLøginScreenAssetRepository(this);
		this.#conditionMetadataDataSource = new LeLøginScreenConditionMetadataDataSource(this);
		this.#createUnderParent.setValue({
			unique: null,
			entityType: LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE
		});
		this.routes.setRoutes([
			{
				path: 'create',
				component: () => import('./rule-workspace.element.js'),
				setup: () => this.#setUpCreate()
			},
			{
				path: 'edit/:unique',
				component: () => import('./rule-workspace.element.js'),
				setup: (_component, info) => this.#setUpEdit(info.match.params.unique)
			}
		]);
	}

	async #setUpCreate() {
		this.#loads.begin();
		this.#unique.setValue(globalThis.crypto.randomUUID());
		this.#isNew.setValue(true);
		await Promise.all([this.loadAssets(), this.loadConditionMetadata()]);
		this.#showDraft(createEmptyRuleDraft(this.#conditionMetadata.getValue()));
	}

	async #setUpEdit(unique: string | undefined) {
		this.#loads.begin();
		this.#unique.setValue(unique);
		this.#isNew.setValue(false);
		if (unique === undefined) {
			this.#showDraft(null);
			return;
		}
		await Promise.all([this.loadAssets(), this.loadConditionMetadata(), this.loadRule(unique)]);
	}

	/** Shows `draft` as the saved state and starts editing a copy of it. */
	#showDraft(draft: LoginRuleDraft | null) {
		this.#currentRule.setValue(draft);
		this.#draft = draft === null ? null : cloneRuleDraft(draft);
		this.#name.setValue(draft?.name ?? '');
	}

	/** @returns The rule entity type. */
	getEntityType() {
		return LOGIN_SCREEN_RULE_ENTITY_TYPE;
	}
	/** @returns Id of the rule, a draft id while creating, or `undefined` before a route has matched. */
	getUnique() {
		return this.#unique.getValue();
	}
	/** @returns The draft's current name. */
	getName(): string {
		return this.#name.getValue();
	}
	/**
	 * Renames the draft; nothing is saved until submit.
	 *
	 * @param name - The new name.
	 */
	setName(name: string) {
		this.updateDraft({ name });
	}
	/** @returns True until a new rule is first saved. */
	getIsNew(): boolean {
		return this.#isNew.getValue();
	}
	/** @returns A copy of the draft, or `null` when nothing is loaded. */
	getDraft(): LoginRuleDraft | null {
		return this.#draft === null ? null : cloneRuleDraft(this.#draft);
	}

	/**
	 * Loads every asset into `assets`. Errors are logged and returned, not thrown.
	 *
	 * @returns The assets, or the repository error.
	 */
	async loadAssets() {
		const { data, error } = await this.#assetRepository.requestItems();
		if (error) {
			console.error('[LeLøginScreen] Failed to load assets for rule editor', error);
			return { data: undefined, error };
		}
		const assets = data ?? [];
		this.#assets.setValue(assets);
		return { data: assets, error: undefined };
	}

	/**
	 * Loads the condition metadata into `conditionMetadata`. Errors are logged and returned, not thrown.
	 *
	 * @returns The metadata, or the data source error.
	 */
	async loadConditionMetadata() {
		const { data, error } = await this.#conditionMetadataDataSource.getConditionMetadata();
		if (error) {
			console.error('[LeLøginScreen] Failed to load condition metadata', error);
			return { data: undefined, error };
		}
		this.#conditionMetadata.setValue(data ?? null);
		return { data, error: undefined };
	}

	/**
	 * Loads one rule and makes it the draft. Clears the previous draft first, and ignores the
	 * result when a newer load has started since. Errors are logged and returned, not thrown.
	 *
	 * @param ruleId - Id of the rule to load.
	 * @returns The rule as a draft, the repository error, or neither when the load was overtaken.
	 */
	async loadRule(ruleId: string) {
		this.#isLoading.setValue(true);
		if (!this.loading.getStates().some((s) => s.unique === 'loading')) {
			this.loading.addState({
				unique: 'loading',
				message: this.#localize.term('loginScreen_loadingRule')
			});
		}
		this.#unique.setValue(ruleId);
		const isLatest = this.#loads.begin();
		// Drop the previous rule's draft before fetching. If this load fails or is overtaken by a
		// newer one, Save then has nothing to write, rather than the previous rule's values under this id.
		this.#showDraft(null);
		try {
			const { data, error } = await this.#ruleRepository.requestByUnique(ruleId);
			if (!isLatest()) return { data: undefined, error: undefined };
			if (error) {
				console.error('[LeLøginScreen] Failed to load rule', error);
				return { data: undefined, error };
			}
			const draft = data === undefined ? null : ruleToDraft(data);
			this.#showDraft(draft);
			return { data: draft, error: undefined };
		} finally {
			// A superseded load leaves the loading state to the newer one.
			if (isLatest()) {
				this.#isLoading.setValue(false);
				this.loading.removeState('loading');
			}
		}
	}

	/**
	 * Reflects an enabled flag that was saved outside the editor (the Enable/Disable action)
	 * without saving, or discarding, the draft's other unsaved edits. Ignored for any rule but
	 * the one being edited.
	 *
	 * @param ruleId - Id of the rule whose flag was saved.
	 * @param enabled - The saved value.
	 */
	applySavedEnabled(ruleId: string, enabled: boolean) {
		if (this.#unique.getValue() !== ruleId) return;
		if (this.#draft !== null) {
			this.#draft = { ...this.#draft, enabled };
			this.#currentRule.setValue(cloneRuleDraft(this.#draft));
			return;
		}
		const current = this.#currentRule.getValue();
		if (current !== null) this.#currentRule.setValue({ ...current, enabled });
	}

	/**
	 * Merges changes into the draft; does nothing before a draft exists.
	 *
	 * @param update - The fields to change.
	 */
	updateDraft(update: Partial<LoginRuleDraft>) {
		if (this.#draft === null) return;
		this.#draft = { ...this.#draft, ...update };
		if (update.name !== undefined) this.#name.setValue(update.name);
	}

	/**
	 * Validates and saves the draft, showing a notification for the outcome. A new rule takes a
	 * fresh id and the URL switches to its edit route. On success, reloads the tree so the new or
	 * renamed rule shows.
	 *
	 * @returns True when the rule was saved.
	 */
	async requestSubmit() {
		if (this.#draft === null) return false;
		const validationState = validateRuleDraft(this.#draft);
		if (validationState !== undefined) {
			await this.#notify(
				'danger',
				this.#localize.term(RULE_DRAFT_VALIDATION_TERMS[validationState])
			);
			return false;
		}
		const wasNew = this.#draft.id === undefined;
		const { data, error } = await this.#saveRule(this.#draft);
		if (error || data === undefined) {
			await this.#notify('danger', this.#localize.term('loginScreen_ruleSaveFailed'));
			return false;
		}
		await this.#notify(
			'positive',
			this.#localize.term(wasNew ? 'loginScreen_ruleCreated' : 'loginScreen_ruleSaved')
		);
		// Show the new rule, or the renamed one, in the sidebar tree.
		if (wasNew) await requestChildrenReload(this, null, LOGIN_SCREEN_RULE_LIST_ENTITY_TYPE);
		else if (data.id !== undefined)
			await requestStructureReload(this, data.id, LOGIN_SCREEN_RULE_ENTITY_TYPE);
		return true;
	}

	async #notify(color: 'positive' | 'danger', message: string) {
		const ctx = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		ctx?.peek(color, { data: { message } });
	}

	async #saveRule(draft: LoginRuleDraft) {
		const isCurrent = this.#loads.begin();
		this.#isLoading.setValue(true);
		const rule = draftToRule(draft, globalThis.crypto.randomUUID());
		try {
			const response =
				draft.id === undefined
					? await this.#ruleRepository.create(rule)
					: await this.#ruleRepository.update(draft.id, rule);
			const { data, error } = response;
			if (error) {
				console.error('[LeLøginScreen] Failed to save rule', error);
				return { data: undefined, error };
			}
			// Only update editor state and URL if the user has not switched to another rule or create route.
			if (data !== undefined && isCurrent()) {
				this.#showDraft(ruleToDraft(data));
				this.#unique.setValue(data.id);
				this.#isNew.setValue(false);
				if (draft.id === undefined)
					window.history.replaceState(null, '', buildRuleWorkspacePath(data.id));
			}
			return { data: data === undefined ? undefined : ruleToDraft(data), error: undefined };
		} finally {
			if (isCurrent()) {
				this.#isLoading.setValue(false);
			}
		}
	}

	/**
	 * Deletes a rule and, when the server confirms, clears the editor's rule and draft. Errors are
	 * logged and returned, not thrown.
	 *
	 * @param ruleId - Id of the rule to delete.
	 * @returns Whether the rule was deleted, or the repository error.
	 */
	async deleteRule(ruleId: string) {
		const { data, error } = await this.#ruleRepository.delete(ruleId);
		if (error) {
			console.error('[LeLøginScreen] Failed to delete rule', error);
			return { data: false, error };
		}
		if (data) {
			this.#currentRule.setValue(null);
			this.#draft = null;
		}
		return { data, error: undefined };
	}
}

export { LeLøginScreenRuleEditorWorkspaceContext as api };
