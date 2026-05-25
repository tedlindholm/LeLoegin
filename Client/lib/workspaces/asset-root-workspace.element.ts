import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { escapeHTML } from '@umbraco-cms/backoffice/utils';
import styles from './asset-root-workspace.element.css?inline';
import type { LeLøginScreenAssetCardValue } from './asset-card.element.js';
import type { LeLøginScreenAssetCard } from './asset-card.element.js';
import './asset-card.element.js';
import type { LoginImageAsset } from '../models/index.ts';
import { LeLøginScreenAssetWorkspaceContext } from '../assets/asset-workspace.context.js';
import {
	LOGIN_SCREEN_ASSET_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE,
	LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE,
} from '../tree/types.js';
import { cloneTemplate } from '../utils/template.js';

interface LeLøginScreenPopoverToggleEvent extends Event {
	newState: string;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const createMenuTemplate = document.createElement('template');
createMenuTemplate.innerHTML = /* html */ `
	<uui-button look="outline" popovertarget="le-løgin-create-popover">
		<span class="create-label"></span>
		<uui-symbol-expand></uui-symbol-expand>
	</uui-button>
	<uui-popover-container id="le-løgin-create-popover" placement="bottom-start">
		<umb-popover-layout>
			<uui-scroll-container>
				<uui-menu-item class="background-upload-item">
					<umb-icon slot="icon" name="icon-picture"></umb-icon>
					<span class="background-upload-label"></span>
				</uui-menu-item>
				<uui-menu-item class="logo-upload-item">
					<umb-icon slot="icon" name="icon-tag"></umb-icon>
					<span class="logo-upload-label"></span>
				</uui-menu-item>
			</uui-scroll-container>
		</umb-popover-layout>
	</uui-popover-container>
`;

const assetSectionTemplate = document.createElement('template');
assetSectionTemplate.innerHTML = /* html */ `<uui-box></uui-box>`;

const assetGridTemplate = document.createElement('template');
assetGridTemplate.innerHTML = /* html */ `<div class="asset-card-grid"></div>`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
const isAssetCardElement = (value: Element | null): value is LeLøginScreenAssetCard =>
	value instanceof HTMLElement && 'value' in value;

function getRequiredById<T extends Element>(
	root: ShadowRoot,
	id: string,
	guard: ElementGuard<T>,
	description: string,
): T {
	const element = root.getElementById(id);
	if (!guard(element)) {
		throw new Error(`Expected ${description} with id "${id}".`);
	}
	return element;
}

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

const WORKSPACE_BASE = '/umbraco/section/settings/workspace';
const BACKGROUND_UPLOAD_PATH = `${WORKSPACE_BASE}/${LOGIN_SCREEN_ASSET_UPLOAD_BACKGROUND_ENTITY_TYPE}/edit/null`;
const LOGO_UPLOAD_PATH = `${WORKSPACE_BASE}/${LOGIN_SCREEN_ASSET_UPLOAD_LOGO_ENTITY_TYPE}/edit/null`;

/**
 * Asset root workspace — collection-style overview for login screen assets.
 */
export class LeLøginScreenAssetRootWorkspace extends UmbElementMixin(HTMLElement) {
	#workspaceContext = new LeLøginScreenAssetWorkspaceContext(this);
	#assets: LoginImageAsset[] = [];
	#isLoading = true;
	#loadError = false;
	#createMenuOpen = false;
	#actions: HTMLElement | undefined;
	#content: HTMLElement | undefined;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });

		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		this.observe(this.#workspaceContext.assets, (assets) => {
			this.#assets = assets ?? [];
			this.#render();
		});

		this.observe(this.#workspaceContext.isLoading, (isLoading) => {
			this.#isLoading = isLoading;
			this.#render();
		});

		this.observe(this.#workspaceContext.loadError, (loadError) => {
			this.#loadError = loadError;
			this.#render();
		});
	}

	override connectedCallback() {
		super.connectedCallback();

		if (this.#actions === undefined || this.#content === undefined) {
			const shadow = this.shadowRoot;
			if (shadow === null) {
				return;
			}
			shadow.innerHTML = /* html */ `
				<umb-workspace-editor headline="${escapeHTML(this.localize.term('loginScreen_assets'))}" alias="LeLøgin.Workspace.AssetRoot" enforceNoFooter>
					<div id="layout">
						<div id="actions"></div>
						<div id="content"></div>
					</div>
				</umb-workspace-editor>
			`;
			this.#actions = getRequiredById(shadow, 'actions', isHtmlElement, 'actions container');
			this.#content = getRequiredById(shadow, 'content', isHtmlElement, 'content container');
		}

		this.#render();
		void this.#workspaceContext.load();
	}

	#render() {
		if (this.#actions === undefined || this.#content === undefined) {
			return;
		}

		this.#actions.replaceChildren(this.#buildCreateActions());
		this.#content.replaceChildren(...this.#buildContentNodes());

		const createPopover = this.#actions.querySelector('#le-løgin-create-popover');
		if (createPopover instanceof HTMLElement) {
			createPopover.addEventListener('toggle', this.#onCreateMenuToggle);
		}
	}

	#buildContentNodes(): Array<HTMLElement> {
		if (this.#isLoading) {
			return [this.#buildStatusSection(this.localize.term('loginScreen_loadingAssets'))];
		}

		if (this.#loadError) {
			return [this.#buildStatusSection('Failed to load assets. Check browser console for details.', 'var(--uui-color-danger)')];
		}

		const backgrounds = this.#assets.filter((a) => a.kind === 'background');
		const logos = this.#assets.filter((a) => a.kind === 'logo');

		return [
			this.#buildAssetSection(
				this.localize.term('loginScreen_assetsWelcomeImages'),
				backgrounds,
				'backgrounds-card-grid',
				this.localize.term('loginScreen_assetsWelcomeImagesEmpty'),
			),
			this.#buildAssetSection(
				this.localize.term('loginScreen_assetsLogos'),
				logos,
				'logos-card-grid',
				this.localize.term('loginScreen_assetsLogosEmpty'),
			),
		];
	}

	#buildCreateActions(): DocumentFragment {
		const fragment = cloneTemplate(createMenuTemplate, 'create menu');

		const createLabel = this.localize.term('general_create');
		const backgroundLabel = `${this.localize.term('grid_media')}...`;
		const logoLabel = `${this.localize.term('loginScreen_createAssetLogo')}...`;

		const createButton = queryRequired(fragment, 'uui-button', isHtmlElement, 'create button');
		createButton.setAttribute('label', createLabel);

		const createLabelElement = queryRequired(fragment, '.create-label', isHtmlElement, 'create label');
		createLabelElement.textContent = createLabel;

		const expandIndicator = queryRequired(fragment, 'uui-symbol-expand', isHtmlElement, 'expand indicator');
		if (this.#createMenuOpen) {
			expandIndicator.setAttribute('open', '');
		} else {
			expandIndicator.removeAttribute('open');
		}

		const backgroundMenuItem = queryRequired(fragment, '.background-upload-item', isHtmlElement, 'background upload item');
		backgroundMenuItem.setAttribute('label', backgroundLabel);
		backgroundMenuItem.setAttribute('href', BACKGROUND_UPLOAD_PATH);
		const backgroundLabelElement = queryRequired(fragment, '.background-upload-label', isHtmlElement, 'background upload label');
		backgroundLabelElement.textContent = backgroundLabel;

		const logoMenuItem = queryRequired(fragment, '.logo-upload-item', isHtmlElement, 'logo upload item');
		logoMenuItem.setAttribute('label', logoLabel);
		logoMenuItem.setAttribute('href', LOGO_UPLOAD_PATH);
		const logoLabelElement = queryRequired(fragment, '.logo-upload-label', isHtmlElement, 'logo upload label');
		logoLabelElement.textContent = logoLabel;

		return fragment;
	}

	#buildStatusSection(message: string, colour?: string): HTMLElement {
		const section = this.#buildEmptySection();
		const messageElement = document.createElement('p');
		messageElement.className = 'empty-state';
		messageElement.textContent = message;
		if (colour !== undefined) {
			messageElement.style.color = colour;
		}
		section.append(messageElement);
		return section;
	}

	#buildAssetSection(
		headline: string,
		assets: Array<LoginImageAsset>,
		gridId: string,
		emptyLabel: string,
	): HTMLElement {
		const section = this.#buildEmptySection();
		section.setAttribute('headline', headline);

		if (assets.length === 0) {
			const message = document.createElement('p');
			message.className = 'empty-state';
			message.textContent = emptyLabel;
			section.append(message);
			return section;
		}

		const gridFragment = cloneTemplate(assetGridTemplate, 'asset grid');

		const grid = queryRequired(gridFragment, '.asset-card-grid', isHtmlElement, 'asset card grid');
		grid.id = gridId;
		for (const asset of assets) {
			grid.append(this.#buildAssetCard(asset));
		}

		section.append(grid);
		return section;
	}

	#buildEmptySection(): HTMLElement {
		const fragment = cloneTemplate(assetSectionTemplate, 'asset section');
		return queryRequired(fragment, 'uui-box', isHtmlElement, 'asset section');
	}

	#buildAssetCard(asset: LoginImageAsset): LeLøginScreenAssetCard {
		const card = document.createElement('login-screen-asset-card');
		if (!isAssetCardElement(card)) {
			throw new Error('Expected login-screen-asset-card custom element.');
		}

		card.value = this.#createCardValue(asset);
		return card;
	}

	#createCardValue(asset: LoginImageAsset): LeLøginScreenAssetCardValue {
		return {
			entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE,
			unique: asset.id,
			name: asset.name,
			href: `/umbraco/section/settings/workspace/login-screen-asset/edit/${encodeURIComponent(asset.id)}`,
			src: `/umbraco/le-løgin/api/v1/assets/${encodeURIComponent(asset.id)}/thumbnail`,
			alt: asset.altText ?? asset.name
		};
	}

	#onCreateMenuToggle = (event: Event) => {
		if (!this.#isPopoverToggleEvent(event)) {
			return;
		}

		this.#createMenuOpen = event.newState === 'open';
		this.#syncCreateMenuIndicator();
	};

	#syncCreateMenuIndicator() {
		const expand = this.shadowRoot?.querySelector('uui-symbol-expand');
		if (!(expand instanceof HTMLElement)) {
			return;
		}

		if (this.#createMenuOpen) {
			expand.setAttribute('open', '');
			return;
		}

		expand.removeAttribute('open');
	}

	#isPopoverToggleEvent(event: Event): event is LeLøginScreenPopoverToggleEvent {
		return 'newState' in event && typeof event.newState === 'string';
	}
}

customElements.define('login-screen-asset-root-workspace', LeLøginScreenAssetRootWorkspace);

export default LeLøginScreenAssetRootWorkspace;
