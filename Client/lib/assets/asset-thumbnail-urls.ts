/** Creates and revokes in-browser URLs; injectable so tests can observe both. */
export interface ObjectUrlFactory {
	/**
	 * Creates an object URL for a blob.
	 *
	 * @param blob - The image data
	 * @returns A URL valid until revoked
	 */
	create(blob: Blob): string;
	/**
	 * Revokes an object URL created by {@link create}, releasing its blob.
	 *
	 * @param url - The URL to revoke
	 */
	revoke(url: string): void;
}

const browserObjectUrls: ObjectUrlFactory = {
	create: (blob) => URL.createObjectURL(blob),
	revoke: (url) => URL.revokeObjectURL(url)
};

/**
 * Turns authenticated thumbnail downloads into URLs an `<img>` or CSS background can use.
 *
 * An `<img src>` cannot send the backoffice bearer token, so each thumbnail is fetched through
 * the authenticated API and exposed as an object URL. Each asset is loaded once; a failed load
 * is not retried, so a render that peeks again cannot start a request loop. {@link dispose}
 * revokes every URL handed out, which invalidates them.
 */
export class AssetThumbnailUrls {
	readonly #load: (assetId: string) => Promise<Blob | undefined>;
	readonly #onChange: () => void;
	readonly #objectUrls: ObjectUrlFactory;
	readonly #requested = new Set<string>();
	readonly #urls = new Map<string, string>();
	#disposed = false;

	/**
	 * Creates an empty URL cache; nothing loads until {@link peek} is called.
	 *
	 * @param load - Fetches the thumbnail for an asset; resolves to `undefined` when it cannot.
	 * @param onChange - Called once for each thumbnail that becomes available.
	 * @param objectUrls - Creates and revokes the object URLs.
	 */
	constructor(
		load: (assetId: string) => Promise<Blob | undefined>,
		onChange: () => void,
		objectUrls: ObjectUrlFactory = browserObjectUrls
	) {
		this.#load = load;
		this.#onChange = onChange;
		this.#objectUrls = objectUrls;
	}

	/**
	 * Returns the thumbnail URL when it is ready, and starts loading it the first time it is
	 * asked for.
	 *
	 * @param assetId - The asset whose thumbnail is wanted.
	 * @returns The object URL, or `undefined` while loading, after a failed load, or after disposal.
	 */
	peek(assetId: string): string | undefined {
		if (this.#disposed) return undefined;
		const url = this.#urls.get(assetId);
		if (url !== undefined || this.#requested.has(assetId)) return url;

		this.#requested.add(assetId);
		void this.#loadUrl(assetId);
		return undefined;
	}

	/** Revokes every URL this instance created and stops accepting late downloads. */
	dispose() {
		this.#disposed = true;
		for (const url of this.#urls.values()) {
			this.#objectUrls.revoke(url);
		}
		this.#urls.clear();
	}

	async #loadUrl(assetId: string) {
		const blob = await this.#load(assetId).catch(() => undefined);
		if (blob === undefined || this.#disposed) return;

		this.#urls.set(assetId, this.#objectUrls.create(blob));
		this.#onChange();
	}
}
