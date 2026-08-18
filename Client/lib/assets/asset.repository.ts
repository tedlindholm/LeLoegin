import { UmbRepositoryBase } from '@umbraco-cms/backoffice/repository';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import type { FocalPoint, LoginImageAsset, LoginImageAssetKind } from '../models/index.js';
import { LeLøginScreenAssetDataSource } from './asset.data-source.js';

/**
 * Repository for login screen assets.
 *
 * The repository defines the operations available to the backoffice, while the
 * data source encapsulates the API transport details.
 */
export class LeLøginScreenAssetRepository extends UmbRepositoryBase {
	#dataSource: LeLøginScreenAssetDataSource;

	constructor(host: UmbControllerHost) {
		super(host);
		this.#dataSource = new LeLøginScreenAssetDataSource(this);
	}

	/**
	 * Requests all login screen assets, optionally filtering by specific IDs.
	 *
	 * @param uniques - Optional array of asset IDs to filter by
	 * @returns A promise resolving to an object with asset array or error
	 *
	 * @example
	 * ```typescript
	 * // Get all assets
	 * const { data, error } = await repository.requestItems();
	 *
	 * // Get specific assets
	 * const { data, error } = await repository.requestItems(['asset-1', 'asset-2']);
	 * ```
	 */
	async requestItems(uniques?: string[]) {
		const { data, error } = await this.#dataSource.getAssets();

		if (uniques === undefined) {
			return {
				data,
				error
			};
		}

		return {
			data: data?.filter((asset) => uniques.includes(asset.id)),
			error
		};
	}

	/**
	 * Uploads a new login screen asset.
	 *
	 * @param file - The image file to upload
	 * @param name - The display name for the asset
	 * @param altText - Optional alternative text for accessibility
	 * @returns A promise resolving to an object with the created asset or error
	 *
	 * @example
	 * ```typescript
	 * const file = new File(['...'], 'background.jpg', { type: 'image/jpeg' });
	 * const { data, error } = await repository.upload(file, 'Main Background', 'Login background');
	 * ```
	 */
	async upload(file: File, name: string, kind: LoginImageAssetKind, altText?: string) {
		return this.#dataSource.uploadAsset(file, name, kind, altText);
	}

	/**
	 * Deletes a login screen asset.
	 *
	 * @param unique - The unique identifier of the asset to delete
	 * @returns A promise resolving to an object with success boolean or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await repository.delete('asset-123');
	 * ```
	 */
	async delete(unique: string) {
		return this.#dataSource.deleteAsset(unique);
	}

	/**
	 * Replaces an asset's metadata. The server's PUT is replace, not patch — every field is
	 * overwritten from the request — so callers must supply the complete state, passing null
	 * to clear a field.
	 *
	 * @param unique - The unique identifier of the asset
	 * @param update - The complete replacement metadata for the asset
	 * @returns A promise resolving to an object with the updated asset or error
	 */
	async update(
		unique: string,
		update: {
			name: string;
			altText: string | null;
			greetingText: string | null;
			logoAssetId: string | null;
			focalPoint: FocalPoint | null;
			zoom: number | null;
		}
	) {
		return this.#dataSource.updateAsset(unique, update);
	}

	/**
	 * Retrieves a single asset by its unique identifier.
	 *
	 * @param unique - The unique identifier of the asset
	 * @returns A promise resolving to an object with the asset or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await repository.requestByUnique('asset-123');
	 * ```
	 */
	async requestByUnique(unique: string) {
		const { data, error } = await this.requestItems();
		return {
			data: data?.find((asset: LoginImageAsset) => asset.id === unique),
			error
		};
	}

	/**
	 * Retrieves an authenticated preview blob for an asset.
	 *
	 * @param unique - The unique identifier of the asset
	 * @returns A promise resolving to an object with the preview blob or error
	 */
	async requestPreview(unique: string) {
		return this.#dataSource.getAssetPreview(unique);
	}
}

export type LeLøginScreenAssetRepositoryResponse = Awaited<
	ReturnType<LeLøginScreenAssetRepository['requestItems']>
>;

export { LeLøginScreenAssetRepository as api };
