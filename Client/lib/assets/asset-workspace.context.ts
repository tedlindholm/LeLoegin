import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbArrayState, UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';
import type { LoginImageAsset, LoginImageAssetKind } from '../models/index.js';
import { LeLøginScreenAssetRepository } from './asset.repository.js';
import {
	UMB_ACTION_EVENT_CONTEXT,
	type UmbActionEventContext
} from '@umbraco-cms/backoffice/action';
import {
	UmbEntityActionEvent,
	UmbRequestReloadStructureForEntityEvent
} from '@umbraco-cms/backoffice/entity-action';
import { LOGIN_SCREEN_ASSET_ENTITY_TYPE } from '../tree/types.js';

/** Context token for consuming the asset workspace context from descendant elements. */
export const UMB_LOGIN_SCREEN_ASSET_WORKSPACE_CONTEXT =
	new UmbContextToken<LeLøginScreenAssetWorkspaceContext>(
		'UmbWorkspaceContext',
		'LeLøgin.WorkspaceContext.Asset'
	);

/**
 * Workspace context for asset management.
 *
 * This owns the asset state for the current workspace instance and coordinates
 * asset operations through the repository layer.
 */
export class LeLøginScreenAssetWorkspaceContext extends UmbContextBase {
	#repository: LeLøginScreenAssetRepository;
	#assets = new UmbArrayState<LoginImageAsset>([], (asset) => asset.id);
	#isLoading = new UmbBooleanState(false);
	#loadError = new UmbBooleanState(false);

	/** The loaded assets, keyed by id. */
	readonly assets = this.#assets.asObservable();
	/** True while {@link load} is in flight. */
	readonly isLoading = this.#isLoading.asObservable();
	/** True when the most recent {@link load} failed. */
	readonly loadError = this.#loadError.asObservable();

	#actionEvents: UmbActionEventContext | undefined;

	/**
	 * Provides the context and subscribes to asset structure-reload events so the list stays fresh.
	 *
	 * @param host - The controller host that provides this context
	 */
	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_ASSET_WORKSPACE_CONTEXT);
		this.#repository = new LeLøginScreenAssetRepository(this);

		// Umbraco's entity actions (delete on a card) and Le Løgin's own saves announce changes
		// through the action event context; reload so the cards never show a stale list.
		this.consumeContext(UMB_ACTION_EVENT_CONTEXT, (actionEvents) => {
			this.#actionEvents?.removeEventListener(
				UmbRequestReloadStructureForEntityEvent.TYPE,
				this.#onStructureChanged
			);
			this.#actionEvents = actionEvents;
			this.#actionEvents?.addEventListener(
				UmbRequestReloadStructureForEntityEvent.TYPE,
				this.#onStructureChanged
			);
		});
	}

	/** Unsubscribes from action events before tearing down the context. */
	override destroy() {
		this.#actionEvents?.removeEventListener(
			UmbRequestReloadStructureForEntityEvent.TYPE,
			this.#onStructureChanged
		);
		super.destroy();
	}

	#onStructureChanged = (event: Event) => {
		if (
			event instanceof UmbEntityActionEvent &&
			event.getEntityType() === LOGIN_SCREEN_ASSET_ENTITY_TYPE
		) {
			void this.load();
		}
	};

	/**
	 * Loads all login screen assets into the workspace context state.
	 *
	 * @returns A promise resolving to an object with assets array or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await context.load();
	 * ```
	 */
	async load() {
		this.#isLoading.setValue(true);
		this.#loadError.setValue(false);

		try {
			const { data, error } = await this.#repository.requestItems();
			if (error) {
				console.error('[LeLøginScreen] Failed to load assets', error);
				this.#loadError.setValue(true);
				return { data: undefined, error };
			}

			const assets = data ?? [];
			this.#assets.setValue(assets);
			return { data: assets, error: undefined };
		} finally {
			this.#isLoading.setValue(false);
		}
	}

	/**
	 * Uploads a new asset and refreshes the workspace state.
	 *
	 * @param file - The image file to upload
	 * @param name - The display name for the asset
	 * @param kind - The asset kind to create
	 * @param altText - Optional alternative text for accessibility
	 * @returns A promise resolving to an object with the created asset or error
	 *
	 * @example
	 * ```typescript
	 * const file = new File(['...'], 'background.jpg', { type: 'image/jpeg' });
	 * const { data, error } = await context.upload(file, 'Main Background');
	 * ```
	 */
	async upload(file: File, name: string, kind: LoginImageAssetKind, altText?: string) {
		const { data, error } = await this.#repository.upload(file, name, kind, altText);
		if (error) {
			console.error('[LeLøginScreen] Failed to upload asset', error);
			return { data: undefined, error };
		}

		await this.load();
		return { data, error: undefined };
	}

	/**
	 * Deletes an asset and refreshes the workspace state.
	 *
	 * @param assetId - The unique identifier of the asset to delete
	 * @returns A promise resolving to an object with success boolean or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await context.delete('asset-123');
	 * ```
	 */
	async delete(assetId: string) {
		const { data, error } = await this.#repository.delete(assetId);
		if (error) {
			console.error('[LeLøginScreen] Failed to delete asset', error);
			return { data: false, error };
		}

		if (data) {
			this.#assets.setValue(this.#assets.getValue().filter((asset) => asset.id !== assetId));
		}

		return { data, error: undefined };
	}
}

/** Default `api` export so the workspace context manifest can load this class lazily. */
export { LeLøginScreenAssetWorkspaceContext as api };
