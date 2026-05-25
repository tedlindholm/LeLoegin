import '@umbraco-cms/backoffice/workspace';
import '@umbraco-cms/backoffice/components';
import { UmbElementMixin } from '@umbraco-cms/backoffice/element-api';
import { UmbModalRouteRegistrationController } from '@umbraco-cms/backoffice/router';
import type { UmbModalRouteBuilder } from '@umbraco-cms/backoffice/router';
import { UMB_WORKSPACE_MODAL } from '@umbraco-cms/backoffice/workspace';
import styles from './rule-workspace.element.css?inline';
import '../rules/condition-editor.element.js';
import type { ConditionMetadata, LoginRuleConditionGroup } from '../rules/rule-condition.js';
import type { LoginImageAsset } from '../models/index.js';
import { LOGIN_SCREEN_ASSET_ENTITY_TYPE } from '../tree/types.js';
import {
	UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT,
	type LoginRuleDraft,
	type LeLøginScreenRuleEditorWorkspaceContext,
} from './rule-editor-workspace.context.js';
import { cloneTemplate } from '../utils/template.js';

interface ConditionEditorElement extends HTMLElement {
	conditionMetadata: ConditionMetadata | null;
	conditionGroup: LoginRuleConditionGroup;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

const loadingTemplate = document.createElement('template');
loadingTemplate.innerHTML = /* html */ `<uui-box><uui-loader-circle></uui-loader-circle></uui-box>`;

const emptyStateTemplate = document.createElement('template');
emptyStateTemplate.innerHTML = /* html */ `
	<uui-box>
		<div class="section-body">
			<p class="empty-state"></p>
		</div>
	</uui-box>
`;

const workspaceBodyTemplate = document.createElement('template');
// Note: we deliberately do NOT put `<login-screen-condition-editor>` in the template.
// Custom elements parsed inside a `<template>` are created with state "undefined"
// (not synchronously upgraded), and even after `customElements.upgrade()` on a clone,
// property writes onto the un-upgraded prototype create own-properties that shadow
// the class's getter/setter pair forever — breaking the condition-editor's #render()
// on every property update. Building the element with `document.createElement()`
// below returns a fully-upgraded instance whose setters fire correctly.
workspaceBodyTemplate.innerHTML = /* html */ `
	<uui-box>
		<div class="section-body">
			<uui-form-layout-item>
				<uui-label id="asset-label" slot="label"></uui-label>
				<div id="asset-field"></div>
			</uui-form-layout-item>
			<div id="condition-editor-slot"></div>
		</div>
	</uui-box>
`;

const assetGridTemplate = document.createElement('template');
assetGridTemplate.innerHTML = /* html */ `<div class="asset-card-grid"></div>`;

const assetCardTemplate = document.createElement('template');
assetCardTemplate.innerHTML = /* html */ `
	<uui-card-media selectable>
		<img loading="lazy" />
	</uui-card-media>
`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
const isHtmlImageElement = (value: Element | null): value is HTMLImageElement => value instanceof HTMLImageElement;
const isConditionEditorElement = (value: Element | null): value is ConditionEditorElement =>
	value instanceof HTMLElement && value.localName === 'login-screen-condition-editor';

function getRequiredById<T extends Element>(
	root: ParentNode,
	id: string,
	guard: ElementGuard<T>,
	description: string,
): T {
	const element = root.querySelector(`#${id}`);
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

function hasProperty<K extends string>(value: object, key: K): value is object & Record<K, unknown> {
	return key in value;
}

function isConditionGroup(value: unknown): value is LoginRuleConditionGroup {
	if (typeof value !== 'object' || value === null) {
		return false;
	}

	if (!hasProperty(value, 'operator') || !hasProperty(value, 'conditions')) {
		return false;
	}

	return (value.operator === 'all' || value.operator === 'any') && Array.isArray(value.conditions);
}

function isConditionChangeEvent(event: Event): event is CustomEvent<LoginRuleConditionGroup> {
	return event instanceof CustomEvent && isConditionGroup(event.detail);
}

export class LeLøginScreenRuleWorkspace extends UmbElementMixin(HTMLElement) {
	#workspaceContext: LeLøginScreenRuleEditorWorkspaceContext | undefined;
	#draft: LoginRuleDraft | null = null;
	#assets: Array<LoginImageAsset> = [];
	#conditionMetadata: ConditionMetadata | null = null;
	#isLoading = true;
	#layout: HTMLElement;
	#assetModalRouteBuilder: UmbModalRouteBuilder | null = null;

	constructor() {
		super();
		const shadow = this.attachShadow({ mode: 'open' });
		const sheet = new CSSStyleSheet();
		sheet.replaceSync(styles);
		shadow.adoptedStyleSheets = [sheet];

		shadow.innerHTML = /* html */ `
			<umb-entity-detail-workspace-editor>
				<umb-workspace-header-name-editable slot="header"></umb-workspace-header-name-editable>
				<div id="layout"></div>
			</umb-entity-detail-workspace-editor>
		`;
		this.#layout = getRequiredById(shadow, 'layout', isHtmlElement, 'layout');
		this.#layout.addEventListener('click', this.#onAssetCardClick);
		this.#layout.addEventListener('condition-change', this.#onConditionChange);

		new UmbModalRouteRegistrationController(this, UMB_WORKSPACE_MODAL)
			.addAdditionalPath(LOGIN_SCREEN_ASSET_ENTITY_TYPE)
			.onSetup(() => ({ data: { entityType: LOGIN_SCREEN_ASSET_ENTITY_TYPE, preset: {} } }))
			.observeRouteBuilder((builder) => { this.#assetModalRouteBuilder = builder; this.#render(); });

		this.consumeContext(UMB_LOGIN_SCREEN_RULE_EDITOR_WORKSPACE_CONTEXT, (ctx) => {
			if (ctx === undefined) return;
			this.#workspaceContext = ctx;
			this.observe(ctx.currentRule, (draft) => { this.#draft = draft; this.#render(); });
			this.observe(ctx.assets, (assets) => { this.#assets = assets ?? []; this.#render(); });
			this.observe(ctx.conditionMetadata, (meta) => { this.#conditionMetadata = meta ?? null; this.#render(); });
			this.observe(ctx.isLoading, (loading) => { this.#isLoading = loading; this.#render(); });
			this.observe(ctx.name, (name) => { if (this.#draft !== null && this.#draft.name !== name) { this.#draft = { ...this.#draft, name }; } });
		});
	}

	override connectedCallback() { super.connectedCallback(); this.#render(); }

	#render() {
		this.#layout.replaceChildren(...this.#buildBody());
	}

	#buildBody(): Array<HTMLElement> {
		if (this.#isLoading) {
			return [this.#buildLoadingState()];
		}

		if (this.#draft === null) {
			return [this.#buildEmptyState()];
		}

		const backgroundAssets = this.#assets.filter((a) => a.kind === 'background');
		return [this.#buildWorkspaceBody(this.#draft, backgroundAssets)];
	}

	#buildLoadingState(): HTMLElement {
		const fragment = cloneTemplate(loadingTemplate, 'loading state');
		const element = fragment.firstElementChild;
		if (!(element instanceof HTMLElement)) {
			throw new Error('Loading state template must have a single HTMLElement root.');
		}
		return element;
	}

	#buildEmptyState(): HTMLElement {
		const fragment = cloneTemplate(emptyStateTemplate, 'empty state');
		const box = fragment.firstElementChild;
		if (!(box instanceof HTMLElement)) {
			throw new Error('Empty state template must have a single HTMLElement root.');
		}
		const message = queryRequired(box, '.empty-state', isHtmlElement, 'empty state message');
		message.textContent = this.localize.term('loginScreen_ruleNotFound');
		return box;
	}

	#buildWorkspaceBody(draft: LoginRuleDraft, backgroundAssets: Array<LoginImageAsset>): HTMLElement {
		const fragment = cloneTemplate(workspaceBodyTemplate, 'rule workspace body');
		const box = fragment.firstElementChild;
		if (!(box instanceof HTMLElement)) {
			throw new Error('Rule workspace body template must have a single HTMLElement root.');
		}

		box.setAttribute('headline', this.localize.term('loginScreen_rules'));
		const assetLabel = getRequiredById(box, 'asset-label', isHtmlElement, 'asset label');
		assetLabel.textContent = this.localize.term('grid_media');

		const assetField = getRequiredById(box, 'asset-field', isHtmlElement, 'asset field');
		assetField.replaceChildren(...this.#buildAssetField(backgroundAssets, draft));

		const conditionEditorSlot = getRequiredById(box, 'condition-editor-slot', isHtmlElement, 'condition editor slot');
		// `document.createElement` synchronously upgrades the element (since the class is
		// registered via the import at the top of this file), so the setters below run
		// as real setters — fixing the "Expected condition editor" crash that happens
		// when the element is parsed inside a `<template>`.
		const conditionEditor = document.createElement('login-screen-condition-editor');
		if (!isConditionEditorElement(conditionEditor)) {
			throw new Error('Failed to create login-screen-condition-editor — is the custom element registered?');
		}
		conditionEditor.id = 'condition-editor';
		conditionEditor.conditionMetadata = this.#conditionMetadata;
		conditionEditor.conditionGroup = draft.condition;
		conditionEditorSlot.replaceWith(conditionEditor);

		return box;
	}

	#buildAssetField(backgroundAssets: Array<LoginImageAsset>, draft: LoginRuleDraft): Array<HTMLElement> {
		if (backgroundAssets.length === 0) {
			const emptyState = document.createElement('p');
			emptyState.className = 'empty-state';
			emptyState.textContent = this.localize.term('loginScreen_rulesNeedAssets');
			return [emptyState];
		}

		const fragment = cloneTemplate(assetGridTemplate, 'asset grid');
		const grid = queryRequired(fragment, '.asset-card-grid', isHtmlElement, 'asset card grid');
		for (const asset of backgroundAssets) {
			grid.append(this.#buildAssetCard(asset, draft));
		}
		return [grid];
	}

	#buildAssetCard(asset: LoginImageAsset, draft: LoginRuleDraft): HTMLElement {
		const fragment = cloneTemplate(assetCardTemplate, 'asset card');
		const card = fragment.firstElementChild;
		if (!(card instanceof HTMLElement)) {
			throw new Error('Asset card template must have a single HTMLElement root.');
		}

		card.dataset['assetId'] = asset.id;
		card.setAttribute('name', asset.name);
		if (asset.id === draft.assetId) {
			card.setAttribute('selected', '');
		} else {
			card.removeAttribute('selected');
		}

		const href = this.#buildAssetModalHref(asset.id);
		if (href !== undefined) {
			card.setAttribute('href', href);
		} else {
			card.removeAttribute('href');
		}

		const image = queryRequired(card, 'img', isHtmlImageElement, 'asset thumbnail image');
		image.src = `/umbraco/le-løgin/api/v1/assets/${encodeURIComponent(asset.id)}/thumbnail`;
		image.alt = asset.altText ?? asset.name;
		return card;
	}

	#buildAssetModalHref(assetId: string): string | undefined {
		if (this.#assetModalRouteBuilder === null) {
			return undefined;
		}

		return `${this.#assetModalRouteBuilder({})}edit/${encodeURIComponent(assetId)}`;
	}

	#onAssetCardClick = (event: Event) => {
		if (!(event.target instanceof Element) || this.#draft === null) {
			return;
		}

		const card = event.target.closest<HTMLElement>('uui-card-media[data-asset-id]');
		if (card === null) {
			return;
		}

		const assetId = card.dataset['assetId'];
		if (assetId !== undefined && assetId !== this.#draft.assetId) {
			this.#updateDraft({ assetId }, true);
		}
	};

	#onConditionChange = (event: Event) => {
		if (!isConditionChangeEvent(event)) {
			return;
		}

		this.#updateDraft({ condition: event.detail }, false);
	}

	#updateDraft(update: Partial<LoginRuleDraft>, shouldRender = false) {
		if (this.#draft === null || this.#workspaceContext === undefined) return;
		this.#draft = { ...this.#draft, ...update };
		this.#workspaceContext.updateDraft({ ...this.#draft, name: this.#workspaceContext.getName() });
		if (shouldRender) this.#render();
	}

}

customElements.define('login-screen-rule-workspace', LeLøginScreenRuleWorkspace);
export default LeLøginScreenRuleWorkspace;
