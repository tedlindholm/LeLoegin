import '@umbraco-cms/backoffice/components';
import '@umbraco-cms/backoffice/entity-action';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbEntityContext } from '@umbraco-cms/backoffice/entity';
import { escapeHTML } from '@umbraco-cms/backoffice/utils';

export interface LeLøginScreenAssetCardValue {
	entityType: string;
	unique: string;
	name: string;
	href: string;
	src: string;
	alt: string;
}

export class LeLøginScreenAssetCard extends UmbElementMixin(HTMLElement) {
	#entityContext = new UmbEntityContext(this);
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
				<img src="${escapeHTML(this.#value.src)}" alt="${escapeHTML(this.#value.alt)}" loading="lazy">
				<umb-entity-actions-bundle slot="actions" label="${escapeHTML(this.#value.name)}"></umb-entity-actions-bundle>
			</uui-card-media>
		`;
	}
}

customElements.define('login-screen-asset-card', LeLøginScreenAssetCard);
export default LeLøginScreenAssetCard;
