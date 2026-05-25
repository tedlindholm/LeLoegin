import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UMB_COLLECTION_CONTEXT } from '@umbraco-cms/backoffice/collection';
import styles from './asset-group-card-collection-view.element.css?inline';
import './asset-card.element.js';
import type { LeLøginScreenAssetCard } from './asset-card.element.js';
import type { LeLøginAssetCollectionItemModel } from './asset-group-collection.repository.js';
import { cloneTemplate } from '../utils/template.js';

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const cardGridTemplate = document.createElement('template');
cardGridTemplate.innerHTML = /* html */ `<div class="asset-card-grid"></div>`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
const isAssetCardElement = (value: Element | null): value is LeLøginScreenAssetCard =>
	value instanceof HTMLElement && 'value' in value;

function queryRequired<T extends Element>(
	root: ParentNode,
	selector: string,
	guard: ElementGuard<T>,
	description: string,
): T {
	const element = root.querySelector(selector);
	if (!guard(element)) {
		throw new Error(`Expected ${description} for selector "${selector}".`);
	}
	return element;
}

export class LeLøginScreenAssetGroupCardCollectionView extends UmbElementMixin(HTMLElement) {
	#items: Array<LeLøginAssetCollectionItemModel> = [];
	#root: HTMLElement | undefined;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		this.consumeContext(UMB_COLLECTION_CONTEXT, (ctx) => {
			if (ctx === undefined) return;
			this.observe(ctx.items, (items) => {
				this.#items = (items ?? []) as Array<LeLøginAssetCollectionItemModel>;
				this.#render();
			});
		});
	}

	override connectedCallback() {
		super.connectedCallback();
		if (this.#root === undefined) {
			this.#root = document.createElement('div');
			this.shadowRoot!.appendChild(this.#root);
		}
		this.#render();
	}

	#render() {
		if (this.#root === undefined) return;

		if (this.#items.length === 0) {
			const emptyState = document.createElement('p');
			emptyState.className = 'empty-state';
			emptyState.textContent = this.localize.term('loginScreen_assetsWelcomeImagesEmpty');
			this.#root.replaceChildren(emptyState);
			return;
		}

		const fragment = cloneTemplate(cardGridTemplate, 'asset card grid');
		const grid = queryRequired(fragment, '.asset-card-grid', isHtmlElement, 'asset card grid');
		for (const item of this.#items) {
			grid.append(this.#buildAssetCard(item));
		}
		this.#root.replaceChildren(grid);
	}

	#buildAssetCard(item: LeLøginAssetCollectionItemModel): LeLøginScreenAssetCard {
		const card = document.createElement('login-screen-asset-card');
		if (!isAssetCardElement(card)) {
			throw new Error('Expected login-screen-asset-card custom element.');
		}

		card.value = {
			entityType: item.entityType,
			unique: item.unique,
			name: item.name,
			href: item.editHref,
			src: item.thumbnailUrl,
			alt: item.altText ?? item.name,
		};
		return card;
	}
}

customElements.define('login-screen-asset-group-card-collection-view', LeLøginScreenAssetGroupCardCollectionView);
export default LeLøginScreenAssetGroupCardCollectionView;
