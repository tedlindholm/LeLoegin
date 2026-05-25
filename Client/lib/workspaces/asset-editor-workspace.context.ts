import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbBooleanState, UmbObjectState, UmbStringState } from '@umbraco-cms/backoffice/observable-api';
import { UmbWorkspaceRouteManager } from '@umbraco-cms/backoffice/workspace';
import type { UmbWorkspaceContext } from '@umbraco-cms/backoffice/workspace';
import { UmbEntityContext, type UmbEntityModel } from '@umbraco-cms/backoffice/entity';
import { UmbStateManager } from '@umbraco-cms/backoffice/utils';
import { UmbLocalizationController } from '@umbraco-cms/backoffice/localization-api';
import { UMB_NOTIFICATION_CONTEXT } from '@umbraco-cms/backoffice/notification';
import { LeLøginScreenAssetRepository } from '../assets/asset.repository.js';
import type { FocalPoint, LoginImageAsset } from '../models/index.js';
import { LOGIN_SCREEN_ASSET_ENTITY_TYPE, LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE } from '../tree/types.js';

const LOADING_STATE_UNIQUE = 'loginScreenAssetWorkspaceLoading';

const LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS = 'LeLøgin.Workspace.Asset';

export const UMB_LOGIN_SCREEN_ASSET_EDITOR_WORKSPACE_CONTEXT =
	new UmbContextToken<UmbWorkspaceContext, LeLøginScreenAssetEditorWorkspaceContext>(
		'UmbWorkspaceContext',
		undefined,
		(context): context is LeLøginScreenAssetEditorWorkspaceContext =>
			context.getEntityType?.() === LOGIN_SCREEN_ASSET_ENTITY_TYPE
	);

/**
 * Routable workspace context for editing a single login screen asset.
 */
export class LeLøginScreenAssetEditorWorkspaceContext extends UmbContextBase {
	readonly workspaceAlias = LOGIN_SCREEN_ASSET_WORKSPACE_ALIAS;
	readonly routes = new UmbWorkspaceRouteManager(this);
	// Marker the umb-entity-detail-workspace-editor uses to claim this context.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	readonly IS_ENTITY_DETAIL_WORKSPACE_CONTEXT = true;
	readonly loading = new UmbStateManager(this);
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
	#localize = new UmbLocalizationController(this);

	readonly assets = this.#assets.asObservable();
	readonly currentAsset = this.#currentAsset.asObservable();
	readonly data = this.#currentAsset.asObservable();
	readonly isLoading = this.#isLoading.asObservable();
	readonly name = this.#name.asObservable();
	readonly unique = this.#unique.asObservable();
	readonly entityType = this.#entityType.asObservable();
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
			entityType: LOGIN_SCREEN_ASSET_ROOT_ENTITY_TYPE,
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

	getEntityType() {
		return LOGIN_SCREEN_ASSET_ENTITY_TYPE;
	}

	getUnique() {
		return this.#unique.getValue();
	}

	getName(): string {
		return this.#name.getValue();
	}

	setName(name: string) {
		this.updateDraft({ name });
	}

	getIsNew(): boolean {
		return this.#isNew.getValue();
	}

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

	async loadAsset(assetId: string) {
		this.#isLoading.setValue(true);
		if (!this.loading.getStates().some((state) => state.unique === LOADING_STATE_UNIQUE)) {
			this.loading.addState({ unique: LOADING_STATE_UNIQUE, message: 'Loading asset' });
		}
		this.#unique.setValue(assetId);

		try {
			const { data, error } = await this.#repository.requestByUnique(assetId);
			if (error) {
				console.error('[LeLøginScreen] Failed to load asset', error);
				return { data: undefined, error };
			}

			this.#currentAsset.setValue(data ?? null);
			this.#name.setValue(data?.name ?? '');
			this.#draft = data === undefined || data === null ? null : this.#cloneAsset(data);
			return { data, error: undefined };
		} finally {
			this.#isLoading.setValue(false);
			this.loading.removeState(LOADING_STATE_UNIQUE);
		}
	}

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

		const { focalPoint: focalPointUpdate, zoom: zoomUpdate, ...rest } = update;
		this.#draft = {
			...this.#draft,
			...rest,
			...(focalPointUpdate === undefined ? {} : { focalPoint: focalPointUpdate ?? undefined }),
			...(zoomUpdate === undefined ? {} : { zoom: zoomUpdate ?? undefined }),
		};

		if (update.name !== undefined) {
			this.#name.setValue(update.name);
		}
	}

	async requestSubmit() {
		const assetId = this.#unique.getValue();
		if (assetId === undefined || this.#draft === null) {
			return false;
		}

		if (this.#draft.name.trim().length === 0) {
			await this.#notify('danger', this.#localize.term('loginScreen_assetNameRequired'));
			return false;
		}

		const { data, error } = await this.saveAsset(assetId, {
			name: this.#draft.name,
			altText: this.#draft.altText,
			...(this.#draft.kind === 'background'
				? {
					greetingText: this.#draft.greetingText,
					logoAssetId: this.#draft.logoAssetId,
					focalPoint: this.#draft.focalPoint ?? null,
					zoom: this.#draft.zoom ?? null,
				}
				: {}),
		});

		if (error || data === undefined) {
			await this.#notify('danger', this.#localize.term('loginScreen_assetSaveFailed'));
			return false;
		}

		await this.#notify('positive', this.#localize.term('loginScreen_assetSaved'));
		return true;
	}

	async #notify(color: 'positive' | 'danger', message: string) {
		const notificationContext = await this.getContext(UMB_NOTIFICATION_CONTEXT);
		notificationContext?.peek(color, { data: { message } });
	}

	async saveAsset(
		assetId: string,
		update: {
			name: string;
			altText?: string;
			greetingText?: string;
			logoAssetId?: string;
			focalPoint?: FocalPoint | null;
			zoom?: number | null;
		}
	) {
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
