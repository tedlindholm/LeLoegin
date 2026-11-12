import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import {
	UmbBooleanState,
	UmbObjectState,
	UmbStringState
} from '@umbraco-cms/backoffice/observable-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import { UmbEntityContext, type UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbStateManager } from '@umbraco-cms/backoffice/utils';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { FocalPoint, LoginImageAsset } from '../models/index.js';
import {
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE
} from '../tree/types.js';
import { LatestLoad } from '../utils/latest-load.js';
import { requestStructureReload } from '../utils/request-structure-reload.js';
import { toAssetSaveRequest, type AssetSaveRequest } from './asset-save-request.js';

const LOADING_STATE_UNIQUE = 'loginScreenAssetWorkspaceLoading';

const LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS = 'LeLøgin.Workspace.Asset';

/** Context token for the asset editor workspace; matches only a workspace context for a login-screen asset. */
export const UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT = new UmbContextToken<
	UmbWorkspaceContext,
	LeLøginScreenAssetEditorWorkspaceContext
>(
	'UmbWorkspaceContext',
	undefined,
	(context): context is LeLøginScreenAssetEditorWorkspaceContext =>
		context.getEntityType?.() === LOGIN_SCREEN_ASSET_ENTITY_TYPE
);

/**
 * Routable workspace context for editing a single login screen asset. Serves the `edit/:unique`
 * route, loads the asset into an editable draft and saves it back, notifying the user and
 * reloading the tree on success.
 */
export class LeLøginScreenAssetEditorWorkspaceContext extends UmbContextBase {
	/** Alias of the workspace manifest this context belongs to. */
	readonly workspaceAlias = LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS;
	/** Workspace routes; serves `edit/:unique`. */
	readonly routes = new UmbWorkspaceRouteManager(this);
	// Marker the umb-entity-detail-workspace-editor uses to claim this context.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly IS_ENTITY_DETAIL_WORKSPACE_CONTEXT = true;
	/** Loading states the workspace editor shows; holds one entry while an asset loads. */
	readonly loading = new UmbStateManager(this);
	/** Forbidden states the workspace editor reads; Le Løgin adds none. */
	readonly forbidden = new UmbStateManager(this);

	#repository: LeLøginScreenAssetRepository;
	#assets = new UmbObjectState<Array<LoginImageAsset>>([]);
	#currentAsset = new UmbObjectState<LoginImageAsset | null>(null);
	#isLoading = new UmbBooleanState(false);
	#name = new UmbStringState('');
	#unique = new UmbObjectState<string | undefined>(undefined);
	#entityType = new UmbStringState(LOGIN_SCREEN_ASSET_ENTITY_TYPE);
	#isNew = new UmbBooleanState(false);
	#createUnderParent = new UmbObjectState<UmbEntityModel | undefined>(undefined);
	#draft: LoginImageAsset | null = null;
	#loads = new LatestLoad();
	#localize = new UmbLocalizationController(this);

	/** Every asset, used to offer logos to a background. */
	readonly assets = this.#assets.asObservable();
	/** The asset as last loaded or saved, or `null` while loading or when not found. */
	readonly currentAsset = this.#currentAsset.asObservable();
	/** Same as `currentAsset`; the name Umbraco's workspace editor observes. */
	readonly data = this.#currentAsset.asObservable();
	/** True while an asset load is in flight. */
	readonly isLoading = this.#isLoading.asObservable();
	/** The draft's name, shown in the workspace header. */
	readonly name = this.#name.asObservable();
	/** Id of the asset being edited. */
	readonly unique = this.#unique.asObservable();
	/** Always the login-screen asset entity type. */
	readonly entityType = this.#entityType.asObservable();
	/** Always false: assets are created by upload, not in this workspace. */
	readonly isNew = this.#isNew.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParent = this.#createUnderParent.asObservable();
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityUnique = this.#createUnderParent.asObservablePart(
		(parent) => parent?.unique
	);
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly _internal_createUnderParentEntityType = this.#createUnderParent.asObservablePart(
		(parent) => parent?.entityType
	);

	/**
	 * Provides the context, an entity context that follows the edited asset, and the edit route.
	 *
	 * @param host - The workspace's controller host.
	 */
	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT);
		this.#repository = new LeLøginScreenAssetRepository(this);
		const entityContext = new UmbEntityContext(this);
		entityContext.setEntityType(LOGIN_SCREEN_ASSET_ENTITY_TYPE);
		this.observe(this.unique, (unique) => {
			entityContext.setUnique(unique ?? null);
		});
		this.#createUnderParent.setValue({
			unique: null,
			entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE
		});
		this.routes.setRoutes([
			{
				path: 'edit/:unique',
				component: () => import('./asset-workspace.element.js'),
				setup: async (_component, info) => {
					const unique = info.match.params.unique;
					if (unique === undefined) {
						this.#currentAsset.setValue(null);
						this.#assets.setValue([]);
						this.#draft = null;
						this.#name.setValue('');
						this.#unique.setValue(undefined);
						this.#isNew.setValue(false);
						return;
					}

					this.#unique.setValue(unique);
					this.#isNew.setValue(false);
					await Promise.all([this.loadAssets(), this.loadAsset(unique)]);
				}
			}
		]);
	}

	/** @returns The login-screen asset entity type. */
	getEntityType() {
		return LOGIN_SCREEN_ASSET_ENTITY_TYPE;
	}

	/** @returns Id of the asset being edited, or `undefined` before a route has matched. */
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

	/** @returns Always false: this workspace only edits existing assets. */
	getIsNew(): boolean {
		return this.#isNew.getValue();
	}

	/**
	 * Loads every asset into `assets`. Errors are logged and returned, not thrown.
	 *
	 * @returns The assets, or the repository error.
	 */
	async loadAssets() {
		const { data, error } = await this.#repository.requestItems();
		if (error) {
			console.error('[LeLøginScreen] Failed to load assets', error);
			return { data: undefined, error };
		}

		const assets = data ?? [];
		this.#assets.setValue(assets);
		return { data: assets, error: undefined };
	}

	/**
	 * Loads one asset and makes it the draft. Clears the previous draft first, and ignores the
	 * result when a newer load has started since. Errors are logged and returned, not thrown.
	 *
	 * @param assetId - Id of the asset to load.
	 * @returns The asset, the repository error, or neither when the load was overtaken.
	 */
	async loadAsset(assetId: string) {
		this.#isLoading.setValue(true);
		if (!this.loading.getStates().some((state) => state.unique === LOADING_STATE_UNIQUE)) {
			this.loading.addState({
				unique: LOADING_STATE_UNIQUE,
				message: this.#localize.term('loginScreen_loadingAsset')
			});
		}
		this.#unique.setValue(assetId);
		const isLatest = this.#loads.begin();
		// Drop the previous asset's draft before fetching. If this load fails or is overtaken by a
		// newer one, Save then has nothing to write, rather than the previous asset's values under this id.
		this.#currentAsset.setValue(null);
		this.#name.setValue('');
		this.#draft = null;

		try {
			const { data, error } = await this.#repository.requestByUnique(assetId);
			if (!isLatest()) return { data: undefined, error: undefined };
			if (error) {
				console.error('[LeLøginScreen] Failed to load asset', error);
				return { data: undefined, error };
			}

			this.#currentAsset.setValue(data ?? null);
			this.#name.setValue(data?.name ?? '');
			this.#draft = data === undefined || data === null ? null : this.#cloneAsset(data);
			return { data, error: undefined };
		} finally {
			// A superseded load leaves the loading state to the newer one.
			if (isLatest()) {
				this.#isLoading.setValue(false);
				this.loading.removeState(LOADING_STATE_UNIQUE);
			}
		}
	}

	/**
	 * Merges changes into the draft; does nothing before an asset has loaded. For `focalPoint` and
	 * `zoom`, `undefined` leaves the value alone and `null` clears it.
	 *
	 * @param update - The fields to change.
	 */
	updateDraft(update: {
		name?: string;
		altText?: string;
		greetingText?: string;
		logoAssetId?: string;
		focalPoint?: FocalPoint | null;
		zoom?: number | null;
	}) {
		if (this.#draft === null) {
			return;
		}

		const draft = this.#draft;
		if (update.name !== undefined) {
			draft.name = update.name;
			this.#name.setValue(update.name);
		}
		if (update.altText !== undefined) draft.altText = update.altText;
		if (update.greetingText !== undefined) draft.greetingText = update.greetingText;
		if (update.logoAssetId !== undefined) draft.logoAssetId = update.logoAssetId;
		if (update.focalPoint !== undefined) draft.focalPoint = update.focalPoint ?? undefined;
		if (update.zoom !== undefined) draft.zoom = update.zoom ?? undefined;
	}

	/**
	 * Saves the draft, showing a notification for the outcome. Refuses a blank name. On success,
	 * reloads the tree so a rename shows.
	 *
	 * @returns True when the asset was saved.
	 */
	async requestSubmit() {
		const assetId = this.#unique.getValue();
		if (assetId === undefined || this.#draft === null) {
			return false;
		}

		if (this.#draft.name.trim().length === 0) {
			await this.#notify('danger', this.#localize.term('loginScreen_assetNameRequired'));
			return false;
		}

		const { data, error } = await this.saveAsset(assetId, toAssetSaveRequest(this.#draft));

		if (error || data === undefined) {
			await this.#notify('danger', this.#localize.term('loginScreen_assetSaveFailed'));
			return false;
		}

		await this.#notify('positive', this.#localize.term('loginScreen_assetSaved'));
		// Show a renamed asset under its new name in the tree and the asset lists.
		await requestStructureReload(this, assetId, LOGIN_SCREEN_ASSET_ENTITY_TYPE);
		return true;
	}

	async #notify(color: 'positive' | 'danger', message: string) {
		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		notificationContext?.peek(color, { data: { message } });
	}

	/**
	 * Sends a save and, on success, makes the saved asset the current asset and draft and updates
	 * it in `assets`. Errors are logged and returned, not thrown.
	 *
	 * @param assetId - Id of the asset to save.
	 * @param update - The full save body.
	 * @returns The saved asset, or the repository error.
	 */
	async saveAsset(assetId: string, update: AssetSaveRequest) {
		const { data, error } = await this.#repository.update(assetId, update);
		if (error) {
			console.error('[LeLøginScreen] Failed to save asset', error);
			return { data: undefined, error };
		}

		if (data !== undefined) {
			this.#currentAsset.setValue(data);
			this.#name.setValue(data.name);
			this.#draft = this.#cloneAsset(data);
			this.#assets.setValue(
				this.#assets.getValue().map((asset) => (asset.id === data.id ? data : asset))
			);
		}

		return { data, error: undefined };
	}

	/**
	 * Fetches an asset's preview image. Errors are logged and returned, not thrown.
	 *
	 * @param assetId - Id of the asset.
	 * @returns The preview data, or the repository error.
	 */
	async loadAssetPreview(assetId: string) {
		const { data, error } = await this.#repository.requestPreview(assetId);
		if (error) {
			console.error('[LeLøginScreen] Failed to load asset preview', error);
			return { data: undefined, error };
		}

		return { data, error: undefined };
	}

	#cloneAsset(asset: LoginImageAsset): LoginImageAsset {
		return { ...asset };
	}
}

export { LeLøginScreenAssetEditorWorkspaceContext as api };
