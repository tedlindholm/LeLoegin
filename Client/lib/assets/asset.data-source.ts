import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { tryExecute } from '@umbraco-cms/backoffice/resources';
import { V1 } from '../api/index.js';
import {
	mapApiLoginAsset,
	mapApiLoginAssets,
	toApiLoginImageAssetKind,
	type ApiAssetUpdateBody
} from '../models/api-adapters.js';
import type { FocalPoint, LoginImageAssetKind } from '../models/index.js';

/**
 * Data source for login screen asset management endpoints.
 */
export class LeLøginScreenAssetDataSource extends UmbControllerBase {
	constructor(host: UmbControllerHost) {
		super(host);
	}
	/**
	 * Retrieves all login screen assets from the API.
	 *
	 * @returns A promise resolving to an object with asset array or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await dataSource.getAssets();
	 * if (error) {
	 *   console.error('Failed to load assets:', error);
	 * } else {
	 *   console.log('Assets:', data);
	 * }
	 * ```
	 */
	async getAssets() {
		const { data, error } = await tryExecute(this, V1.getUmbracoLeLøginApiV1Assets());
		return {
			data: data === undefined ? undefined : mapApiLoginAssets(data),
			error,
		};
	}

	/**
	 * Uploads a new login screen asset to the server.
	 *
	 * @param file - The image file to upload
	 * @param name - The display name for the asset
	 * @param altText - Optional alternative text for accessibility
	 * @returns A promise resolving to an object with the created asset or error
	 *
	 * @example
	 * ```typescript
	 * const file = new File(['...'], 'background.jpg', { type: 'image/jpeg' });
	 * const { data, error } = await dataSource.uploadAsset(file, 'Main Background');
	 * ```
	 */
	async uploadAsset(file: File, name: string, kind: LoginImageAssetKind, altText?: string) {
		const { data, error } = await tryExecute(
			this,
			V1.postUmbracoLeLøginApiV1Assets({
				body: {
					file,
					name,
					kind: toApiLoginImageAssetKind(kind),
					altText,
				},
			})
		);

		return {
			data: data === undefined ? undefined : mapApiLoginAsset(data),
			error,
		};
	}

	/**
	 * Retrieves a specific login screen asset by ID.
	 *
	 * @param assetId - The unique identifier of the asset
	 * @returns A promise resolving to an object with the asset or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await dataSource.getAsset('asset-123');
	 * ```
	 */
	async getAsset(assetId: string) {
		const { data, error } = await tryExecute(
			this,
			V1.getUmbracoLeLøginApiV1AssetsById({
				path: { id: assetId },
			})
		);

		return {
			data: data === undefined ? undefined : mapApiLoginAsset(data),
			error,
		};
	}

	/**
	 * Retrieves an authenticated asset preview as a binary blob.
	 *
	 * @param assetId - The unique identifier of the asset
	 * @returns A promise resolving to an object with the preview blob or error
	 */
	async getAssetPreview(assetId: string) {
		const { data, error } = await tryExecute(
			this,
			V1.getUmbracoLeLøginApiV1AssetsByIdPreview({
				path: { id: assetId }
			})
		);

		return {
			data: data instanceof Blob ? data : undefined,
			error
		};
	}

	/**
	 * Updates an existing login screen asset's metadata (name and/or alt text).
	 * Automatically refetches the updated asset after successful update.
	 *
	 * @param assetId - The unique identifier of the asset
	 * @param update - Object containing optional name and altText to update
	 * @returns A promise resolving to an object with the updated asset or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await dataSource.updateAsset('asset-123', {
	 *   name: 'Updated Name',
	 *   altText: 'Updated alt text'
	 * });
	 * ```
	 */
	async updateAsset(
		assetId: string,
		update: {
			name?: string;
			altText?: string;
			greetingText?: string;
			logoAssetId?: string;
			focalPoint?: FocalPoint | null;
			zoom?: number | null;
		}
	) {
		const body: ApiAssetUpdateBody = {
			...(update.name === undefined ? {} : { name: update.name }),
			...(update.altText === undefined ? {} : { altText: update.altText }),
			...(update.greetingText === undefined ? {} : { greetingText: update.greetingText }),
			...(update.logoAssetId === undefined ? {} : { logoAssetId: update.logoAssetId }),
			...(update.focalPoint === undefined ? {} : { focalPoint: update.focalPoint }),
			...(update.zoom === undefined ? {} : { zoom: update.zoom }),
		};
		const { error } = await tryExecute(
			this,
			V1.putUmbracoLeLøginApiV1AssetsById({
				path: { id: assetId },
				body,
			})
		);

		if (error) {
			return {
				data: undefined,
				error,
			};
		}

		return this.getAsset(assetId);
	}

	/**
	 * Deletes a login screen asset from the server.
	 *
	 * @param assetId - The unique identifier of the asset to delete
	 * @returns A promise resolving to an object with success boolean or error
	 *
	 * @example
	 * ```typescript
	 * const { data, error } = await dataSource.deleteAsset('asset-123');
	 * if (!error) {
	 *   console.log('Asset deleted successfully');
	 * }
	 * ```
	 */
	async deleteAsset(assetId: string) {
		const { error } = await tryExecute(
			this,
			V1.deleteUmbracoLeLøginApiV1AssetsById({
				path: { id: assetId },
			})
		);

		return {
			data: error ? false : true,
			error,
		};
	}

}
