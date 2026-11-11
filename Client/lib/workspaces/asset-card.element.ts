import '@umbraco-cms/backoffice/components';
import '@umbraco-cms/backoffice/entity-action';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbEntityContext } from '@umbraco-cms/backoffice/entity';
import { escapeHTML } from '@umbraco-cms/backoffice/utils';
import { LeLøginAssetThumbnailController } from '../assets/asset-thumbnail.controller.js';

export interface LeLøginScreenAssetCardValue {
	entityType: string;
	unique: string;
	name: string;
	href: string;
	alt: string;
}

export class LeLøginScreenAssetCard extends UmbElementMixin(HTMLElement) {
	#entityContext = new UmbEntityContext(this);
	#thumbnails = new LeLøginAssetThumbnailController(this, () => this.#syncThumbnail());
	#value?: LeLøginScreenAssetCardValue;

	set value(value: LeLøginScreenAssetCardValue | undefined) {
		this.#value = value;
		this.#entityContext.setEntityType(value?.entityType);
		this.#entityContext.setUnique(value?.unique ?? null);
		this.#render();
	}

	get value() {
		return this.#value;
	}

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
