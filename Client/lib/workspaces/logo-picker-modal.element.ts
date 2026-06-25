import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { type UmbModalContext, UmbModalExtensionElement } from '@umbraco-cms/backoffice/modal';
import styles from './logo-picker-modal.element.css?inline';
import type { LogoPickerModalData, LogoPickerModalValue } from './logo-picker-modal.token.js';
import { UMBRACO_LOGO_SVG } from './asset-workspace.helpers.js';
import { cloneTemplate } from '../utils/template.js';

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const modalBodyTemplate = document.createElement('template');
modalBodyTemplate.innerHTML = /* html */ `
	<umb-body-layout>
		<div id="card-grid" class="grid"></div>
		<div slot="actions">
			<uui-button id="close-btn" look="secondary"></uui-button>
		</div>
	</umb-body-layout>
`;

const logoCardTemplate = document.createElement('template');
logoCardTemplate.innerHTML = /* html */ `
	<uui-card-media selectable>
		<img loading="lazy">
	</uui-card-media>
`;

const emptyLogoCardTemplate = document.createElement('template');
emptyLogoCardTemplate.innerHTML = /* html */ `
	<uui-card-media selectable data-asset-id="">
		${UMBRACO_LOGO_SVG}
	</uui-card-media>
`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
const isHtmlImageElement = (value: Element | null): value is HTMLImageElement =>
	value instanceof HTMLImageElement;

function queryRequired<T extends Element>(
	root: ParentNode,
	selector: string,
	guard: ElementGuard<T>,
	description: string
): T {
	const element = root.querySelector(selector);
	if (!guard(element)) {
		throw new Error(`Expected ${description} for selector "${selector}".`);
	}
	return element;
}

function getEventTargetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

export class LeLøginLogoPickerModalElement
	extends UmbElementMixin(HTMLElement)
	implements UmbModalExtensionElement<LogoPickerModalData, LogoPickerModalValue>
{
	#modalContext: UmbModalContext<LogoPickerModalData, LogoPickerModalValue> | undefined;
	#layout: HTMLElement;

	get modalContext() {
		return this.#modalContext;
	}
	set modalContext(value: UmbModalContext<LogoPickerModalData, LogoPickerModalValue> | undefined) {
		this.#modalContext = value;
		this.#render();
	}

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];
		shadow.innerHTML = /* html */ `<div id="layout"></div>`;
		const layout = shadow.getElementById('layout');
		if (!(layout instanceof HTMLElement)) {
			throw new Error('Expected modal layout container.');
		}
		this.#layout = layout;
		this.#layout.addEventListener('click', (e) => {
			const target = getEventTargetElement(e);
			if (target?.closest('#close-btn') !== null) {
				this.#modalContext?.reject();
				return;
			}

			const card = target?.closest('uui-card-media');
			if (card instanceof HTMLElement) {
				const id = card.dataset['assetId'] ?? '';
				this.#select(id);
			}
		});
	}

	#select(logoAssetId: string) {
		this.#modalContext?.updateValue({ logoAssetId });
		this.#modalContext?.submit();
	}

	#render() {
		const logoAssets = this.#modalContext?.data.logoAssets ?? [];
		const selectedId = this.#modalContext?.data.selectedLogoAssetId ?? '';
		const body = this.#buildModalBody(logoAssets, selectedId);
		this.#layout.replaceChildren(body);
	}

	#buildModalBody(logoAssets: LogoPickerModalData['logoAssets'], selectedId: string): HTMLElement {
		const fragment = cloneTemplate(modalBodyTemplate, 'modal body');
		const body = fragment.firstElementChild;
		if (!(body instanceof HTMLElement)) {
			throw new Error('Modal body template must have a single HTMLElement root.');
		}

		body.setAttribute('headline', this.localize.term('loginScreen_logoAsset'));

		const cardGrid = queryRequired(body, '#card-grid', isHtmlElement, 'card grid');
		cardGrid.replaceChildren(
			this.#buildEmptyLogoCard(selectedId.length === 0),
			...logoAssets.map((asset) => this.#buildLogoCard(asset, asset.id === selectedId))
		);

		const closeButton = queryRequired(body, '#close-btn', isHtmlElement, 'close button');
		const closeLabel = this.localize.term('general_close');
		closeButton.setAttribute('label', closeLabel);
		closeButton.textContent = closeLabel;

		return body;
	}

	#buildEmptyLogoCard(selected: boolean): HTMLElement {
		const fragment = cloneTemplate(emptyLogoCardTemplate, 'empty logo card');
		const card = fragment.firstElementChild;
		if (!(card instanceof HTMLElement)) {
			throw new Error('Empty logo card template must have a single HTMLElement root.');
		}

		card.setAttribute('name', this.localize.term('loginScreen_logoAssetNone'));
		if (selected) {
			card.setAttribute('selected', '');
		} else {
			card.removeAttribute('selected');
		}

		return card;
	}

	#buildLogoCard(asset: LogoPickerModalData['logoAssets'][number], selected: boolean): HTMLElement {
		const fragment = cloneTemplate(logoCardTemplate, 'logo card');
		const card = fragment.firstElementChild;
		if (!(card instanceof HTMLElement)) {
			throw new Error('Logo card template must have a single HTMLElement root.');
		}

		card.dataset['assetId'] = asset.id;
		card.setAttribute('name', asset.name);
		if (selected) {
			card.setAttribute('selected', '');
		} else {
			card.removeAttribute('selected');
		}

		const image = queryRequired(card, 'img', isHtmlImageElement, 'logo thumbnail image');
		image.src = `/umbraco/le-løgin/api/v1/assets/${encodeURIComponent(asset.id)}/thumbnail`;
		image.alt = asset.altText ?? asset.name;

		return card;
	}
}

customElements.define('le-løgin-logo-picker-modal', LeLøginLogoPickerModalElement);
export default LeLøginLogoPickerModalElement;
