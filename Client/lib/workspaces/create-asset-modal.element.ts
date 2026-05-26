import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { type UmbModalContext, UmbModalExtensionElement } from '@umbraco-cms/backoffice/modal';
import styles from './create-asset-modal.element.css?inline';
import type {
	CreateAssetKind,
	CreateAssetModalData,
	CreateAssetModalValue,
} from './create-asset-modal.token.js';
import { cloneTemplate } from '../utils/template.js';

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const modalBodyTemplate = document.createElement('template');
modalBodyTemplate.innerHTML = /* html */ `
	<umb-body-layout>
		<div class="option-list">
			<uui-menu-item class="background-option">
				<umb-icon slot="icon" name="icon-picture"></umb-icon>
			</uui-menu-item>
			<uui-menu-item class="logo-option">
				<umb-icon slot="icon" name="icon-tag"></umb-icon>
			</uui-menu-item>
		</div>
		<div slot="actions">
			<uui-button id="close-btn" look="secondary"></uui-button>
		</div>
	</umb-body-layout>
`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;

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

function getEventTargetElement(event: Event): Element | null {
	return event.target instanceof Element ? event.target : null;
}

export class LeLøginCreateAssetModalElement extends UmbElementMixin(HTMLElement)
	implements UmbModalExtensionElement<CreateAssetModalData, CreateAssetModalValue> {

	#modalContext: UmbModalContext<CreateAssetModalData, CreateAssetModalValue> | undefined;
	#layout: HTMLElement;

	get modalContext() { return this.#modalContext; }
	set modalContext(value: UmbModalContext<CreateAssetModalData, CreateAssetModalValue> | undefined) {
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
			const option = target?.closest('uui-menu-item[data-kind]');
			if (option instanceof HTMLElement) {
				const kind = option.dataset['kind'];
				if (kind === 'background' || kind === 'logo') {
					this.#select(kind);
				}
			}
		});
	}

	#select(kind: CreateAssetKind) {
		this.#modalContext?.updateValue({ kind });
		this.#modalContext?.submit();
	}

	#render() {
		const body = this.#buildModalBody();
		this.#layout.replaceChildren(body);
	}

	#buildModalBody(): HTMLElement {
		const fragment = cloneTemplate(modalBodyTemplate, 'create asset modal body');
		const body = fragment.firstElementChild;
		if (!(body instanceof HTMLElement)) {
			throw new Error('Create asset modal body template must have a single HTMLElement root.');
		}

		body.setAttribute('headline', this.localize.term('general_create'));

		const backgroundOption = queryRequired(body, '.background-option', isHtmlElement, 'background option');
		const backgroundLabel = `${this.localize.term('grid_media')}...`;
		backgroundOption.setAttribute('label', backgroundLabel);
		backgroundOption.dataset['kind'] = 'background';

		const logoOption = queryRequired(body, '.logo-option', isHtmlElement, 'logo option');
		const logoLabel = `${this.localize.term('loginScreen_createAssetLogo')}...`;
		logoOption.setAttribute('label', logoLabel);
		logoOption.dataset['kind'] = 'logo';

		const closeButton = queryRequired(body, '#close-btn', isHtmlElement, 'close button');
		const closeLabel = this.localize.term('general_close');
		closeButton.setAttribute('label', closeLabel);
		closeButton.textContent = closeLabel;

		return body;
	}
}

customElements.define('le-løgin-create-asset-modal', LeLøginCreateAssetModalElement);
export default LeLøginCreateAssetModalElement;
