import { UmbControllerBase } from '@umbraco-cms/backoffice/class-api';
import type { UmbControllerHost } from '@umbraco-cms/backoffice/controller-api';
import { AssetThumbnailUrls } from './asset-thumbnail-urls.js';
import { LeLøginScreenAssetRepository } from './asset.repository.js';

/**
 * Supplies asset thumbnail URLs to an element. Thumbnails are fetched through the
 * authenticated API and exposed as object URLs; the URLs are revoked when the host element
 * disconnects, and loading starts afresh if it reconnects.
 */
export class LeLøginAssetThumbnailController extends UmbControllerBase {
	readonly #repository: LeLøginScreenAssetRepository;
	readonly #onChange: () => void;
	#urls: AssetThumbnailUrls;

	/**
	 * @param host - The element that shows the thumbnails.
	 * @param onChange - Called when a requested thumbnail becomes available, so the host can re-render.
	 */
	constructor(host: UmbControllerHost, onChange: () => void) {
		super(host);
		this.#repository = new LeLøginScreenAssetRepository(this);
		this.#onChange = onChange;
		this.#urls = this.#createUrls();
	}

	/**
	 * @param assetId - The asset whose thumbnail is wanted.
	 * @returns The thumbnail URL once loaded; `undefined` until then or when it cannot be loaded.
	 */
	peek(assetId: string): string | undefined {
		return this.#urls.peek(assetId);
	}

	override hostDisconnected() {
		super.hostDisconnected();
		this.#urls.dispose();
		this.#urls = this.#createUrls();
	}

	override destroy() {
		this.#urls.dispose();
		super.destroy();
	}

	#createUrls() {
		return new AssetThumbnailUrls(
			async (assetId) => (await this.#repository.requestThumbnail(assetId)).data,
			this.#onChange
		);
	}
}
