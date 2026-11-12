import '@umbraco-cms/backoffice/components';
import '@umbraco-cms/backoffice/entity-action';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbEntityContext } from '@umbraco-cms/backoffice/entity';
import { escapeHTML } from '@umbraco-cms/backoffice/utils';
import { LeLøginAssetThumbnailController } from '../assets/asset-thumbnail.controller.js';

/** The data an asset card renders and exposes to its entity actions. */
export interface LeLøginScreenAssetCardValue {
	/** Entity type the card's entity actions act on. */
	entityType: string;
	/** Asset id; also keys the thumbnail lookup. */
	unique: string;
	/** Display name shown on the card. */
	name: string;
	/** Link the card opens, normally the asset workspace. */
	href: string;
	/** Alternative text for the thumbnail image. */
	alt: string;
}

/**
 * Media card for one login-screen asset, with a lazily loaded thumbnail and the asset's entity
 * actions. Provides an entity context so the actions bundle knows which asset it targets.
 */
export class LeLøginScreenAssetCard extends UmbElementMixin(HTMLElement) {
	#entityContext = new UmbEntityContext(this);
	#thumbnails = new LeLøginAssetThumbnailController(this, () => this.#syncThumbnail());
	#value?: LeLøginScreenAssetCardValue;

	/** The asset to show. Setting it updates the entity context and re-renders; `undefined` clears the card. */
	set value(value: LeLøginScreenAssetCardValue | undefined) {
		this.#value = value;
		this.#entityContext.setEntityType(value?.entityType);
		this.#entityContext.setUnique(value?.unique ?? null);
		this.#render();
	}

	get value() {
		return this.#value;
	}

	/** Renders the card when it is attached. */
	override connectedCallback() {
		super.connectedCallback();
		this.#render();
	}

	#render() {
		if (this.#value === undefined) {
			this.innerHTML = '';
			return;
		}
		this.innerHTML = /* html */ `
			<uui-card-media name="${escapeHTML(this.#value.name)}" href="${escapeHTML(this.#value.href)}">
				<img alt="${escapeHTML(this.#value.alt)}" loading="lazy">
				<umb-entity-actions-bundle slot="actions" label="${escapeHTML(this.#value.name)}"></umb-entity-actions-bundle>
			</uui-card-media>
		`;
		this.#syncThumbnail();
	}

	#syncThumbnail() {
		const image = this.querySelector('img');
		if (image === null || this.#value === undefined) return;
		const url = this.#thumbnails.peek(this.#value.unique);
		if (url !== undefined) image.src = url;
	}
}

customElements.define('login-screen-asset-card', LeLøginScreenAssetCard);
export default LeLøginScreenAssetCard;
