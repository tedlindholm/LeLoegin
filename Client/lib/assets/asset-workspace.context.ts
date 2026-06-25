import { UmbContextBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { UmbContextToken } from '@umbraco-cms/backoffice/context-api';
import { UmbArrayState, UmbBooleanState } from '@umbraco-cms/backoffice/observable-api';
import type { LoginImageAsset, LoginImageAssetKind } from '../models/index.js';
import { LeLøginScreenAssetRepository } from './asset.repository.js';

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

	readonly assets = this.#assets.asObservable();
	readonly isLoading = this.#isLoading.asObservable();
	readonly loadError = this.#loadError.asObservable();

	constructor(host: UmbControllerHost) {
		super(host, UMB_LOGIN_SCREEN_ASSET_WORKSPACE_CONTEXT);
		this.#repository = new LeLøginScreenAssetRepository(this);
	}

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

export { LeLøginScreenAssetWorkspaceContext as api };
