import type { LoginImageAsset } from '../models/index.ts';
import {
	isBackgroundLoginImageAsset,
	isLogoLoginImageAsset,
} from '../models/index.ts';
import { cloneTemplate } from '../utils/template.js';

export interface LeLøginScreenTextInputElement extends HTMLElement {
	value: string;
}

export interface SelectOption {
	name: string;
	value: string;
	selected: boolean;
}

interface LeLøginScreenLocaliser {
	term(key: string, placeholders?: Array<string>): string;
}

interface AssetWorkspaceBodyArgs {
	localize: LeLøginScreenLocaliser;
	isLoading: boolean;
	asset: LoginImageAsset | null;
	previewUrl: string | undefined;
	logoAssets: Array<LoginImageAsset>;
	greetingText: string;
	selectedLogoAssetId: string;
	zoom: number;
}

interface LoadedWorkspaceBodyArgs {
	localize: LeLøginScreenLocaliser;
	asset: LoginImageAsset;
	previewUrl: string | undefined;
	logoAssets: Array<LoginImageAsset>;
	greetingText: string;
	selectedLogoAssetId: string;
	zoom: number;
}

interface WorkspacePanelNodes {
	root: HTMLElement;
	body: HTMLElement;
}

type ElementGuard<T extends Element> = (value: Element | null) => value is T;

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;

const workspacePanelTemplate = document.createElement('template');
workspacePanelTemplate.innerHTML = /* html */ `
	<div class="workspace-grid">
		<uui-box class="workspace-panel">
			<div class="workspace-panel-body"></div>
		</uui-box>
	</div>
`;

const logoPreviewTemplate = document.createElement('template');
logoPreviewTemplate.innerHTML = /* html */ `<img class="logo-preview-image" alt="" />`;

const previewStageTemplate = document.createElement('template');
previewStageTemplate.innerHTML = /* html */ `
	<div class="preview-stage">
		<div class="preview-shell">
			<umb-auth-view id="auth-preview"></umb-auth-view>
		</div>
		<div id="preview-overlay"></div>
	</div>
`;

const logoPickerTemplate = document.createElement('template');
logoPickerTemplate.innerHTML = /* html */ `
	<div class="preview-control preview-logo-picker">
		<button id="asset-logo-picker-button" type="button">
			<uui-icon name="icon-edit"></uui-icon>
		</button>
	</div>
`;

const greetingFieldTemplate = document.createElement('template');
greetingFieldTemplate.innerHTML = /* html */ `
	<div class="preview-control preview-greeting-field">
		<uui-input id="asset-greeting-inline" name="greetingText"></uui-input>
	</div>
`;

const isHtmlElement = (value: Element | null): value is HTMLElement => value instanceof HTMLElement;
const isHtmlImageElement = (value: Element | null): value is HTMLImageElement => value instanceof HTMLImageElement;
// Tag-name guards for UUI custom elements: a property-existence check (`'value' in
// el && typeof el.value === 'string'`) fails for un-upgraded clones AND for freshly
// upgraded ones whose `value` defaults to undefined. The tag-name check is reliable
// in both cases — UUI elements are LitElement-based, so any property writes we make
// after the cast are caught by reactive-element's upgrade-fix pass on connection.
const isTextInputElement = (value: Element | null): value is LeLøginScreenTextInputElement =>
	value instanceof HTMLElement && value.localName === 'uui-input';

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

export const normaliseOptionalInputValue = (value: string | undefined) => {
	if (value === undefined) {
		return undefined;
	}

	const trimmedValue = value.trim();
	return trimmedValue.length === 0 ? undefined : trimmedValue;
};

export const buildLogoAssetOptions = (
	localize: LeLøginScreenLocaliser,
	logoAssets: Array<LoginImageAsset>,
	selectedValue: string,
): Array<SelectOption> => {
	return [
		{
			name: localize.term('loginScreen_logoAssetNone'),
			value: '',
			selected: selectedValue.length === 0,
		},
		...logoAssets.map((asset) => ({
			name: asset.name,
			value: asset.id,
			selected: asset.id === selectedValue,
		})),
	];
};

const buildWorkspacePanel = (): WorkspacePanelNodes => {
	const fragment = cloneTemplate(workspacePanelTemplate, 'workspace panel');
	const root = queryRequired(fragment, '.workspace-grid', isHtmlElement, 'workspace grid');
	const body = queryRequired(root, '.workspace-panel-body', isHtmlElement, 'workspace panel body');
	return { root, body };
};

const buildLogoPickerControl = (
	localize: LeLøginScreenLocaliser,
	_logoAssets: Array<LoginImageAsset>,
	_selectedLogoAssetId: string,
	): HTMLElement => {
	const fragment = cloneTemplate(logoPickerTemplate, 'logo picker');
	const control = queryRequired(fragment, '.preview-logo-picker', isHtmlElement, 'logo picker control');
	const button = queryRequired(control, '#asset-logo-picker-button', isHtmlElement, 'logo picker button');
	button.setAttribute('aria-label', localize.term('loginScreen_logoAsset'));
	return control;
};

export const UMBRACO_LOGO_SVG = /* html */ `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" style="display:block;width:100%;height:auto"><path fill="#3544b1" d="M298.86,469.57C299,334.92,408.33,225.91,543,226.08S786.64,335.55,786.46,470.2,677.19,713.68,542.66,713.68c-134.72-.07-243.87-109.35-243.8-244.07Zm238.86,83.48A239,239,0,0,1,481.38,548a43.08,43.08,0,0,1-30.78-24.75q-8.27-19.07-8-58.82a374.92,374.92,0,0,1,2.6-41.43q2.38-20.09,4.76-33.11l1.67-8.63a4.82,4.82,0,0,0,0-.76,5,5,0,0,0-4.09-4.9l-31.45-4.9h-.68a5,5,0,0,0-4.81,3.82c-.54,2-.85,3.51-1.79,8.31-1.8,9.26-3.46,18.29-5.31,31.46a409.48,409.48,0,0,0-3.54,43.13,220.41,220.41,0,0,0,0,30.19q1.11,40,13.74,63.94t42.78,34.42q30.15,10.51,84,10.29H545q53.91.22,84-10.29t42.78-34.42q12.63-23.94,13.75-63.94a223.65,223.65,0,0,0,0-30.19,409.5,409.5,0,0,0-3.55-43.13c-1.84-13-3.51-22-5.3-31.46-1-4.8-1.26-6.29-1.8-8.31a4.94,4.94,0,0,0-4.81-3.82h-.81l-31.45,4.9a4.94,4.94,0,0,0-4.13,4.9,4.82,4.82,0,0,0,0,.76l1.66,8.63q2.38,13.06,4.81,33.11a379.81,379.81,0,0,1,2.56,41.43q.4,39.68-8,58.77A43.07,43.07,0,0,1,604.09,548a238.71,238.71,0,0,1-56.3,5.08Z"/><path fill="#3544b1" d="M744.18,817.91c0-21.08,6-35.87,30.41-35.87S805,796.83,805,817.91s-6,35.86-30.38,35.86S744.18,839,744.18,817.91Zm45.31,0c0-14.66-1.9-23-14.9-23s-14.94,8.36-14.94,23,1.93,23,14.94,23S789.49,832.52,789.49,817.91Z"/><path fill="#3544b1" d="M323,851.08a2,2,0,0,0,1.76,1h5.69a2,2,0,0,0,2-2V785.71a2,2,0,0,0-2-2H319.12a2,2,0,0,0-2,2V836.8a31,31,0,0,1-15.86,4c-7.25,0-10.8-3.15-10.8-10.13V785.71a2,2,0,0,0-2-2H277.05a2,2,0,0,0-2,2V832c0,13.14,6.16,21.75,23.54,21.75a39.39,39.39,0,0,0,22.18-7.11l2,4.53Z"/><path fill="#3544b1" d="M450.74,803.79c0-13-6.43-21.77-22.66-21.77a39.1,39.1,0,0,0-21.91,6.79c-2.87-4.23-8.36-6.79-17.53-6.79A35.55,35.55,0,0,0,368,789.13l-2-4.53h0a2,2,0,0,0-1.77-1H358.5a2,2,0,0,0-2,2V850a2,2,0,0,0,2,2h11.33a2,2,0,0,0,2-2V799a27.62,27.62,0,0,1,14.36-4c6.17,0,9.72,2.27,9.72,8.77V850.1a2,2,0,0,0,2,2h11.33a2,2,0,0,0,2-2V799a26.69,26.69,0,0,1,14.39-4c6,0,9.72,2.27,9.72,8.77v46.29a2,2,0,0,0,2,2h11.33a2,2,0,0,0,2-2Z"/><path fill="#3544b1" d="M485.77,846.66A36.19,36.19,0,0,0,508,853.77c20,0,27.37-13.41,27.37-35.86S527.93,782,508,782a34.67,34.67,0,0,0-18.35,5.35V766.68a2,2,0,0,0-2-2.06H476.23a2,2,0,0,0-2,2V850.1a2,2,0,0,0,2,2h5.69a2,2,0,0,0,1.76-1h0Zm18.6-5.89a29.23,29.23,0,0,1-14.77-4V799a29.23,29.23,0,0,1,14.77-4c13.41,0,15.48,10.27,15.48,22.87s-2,22.86-15.46,22.86Z"/><path fill="#3544b1" d="M592,795.5a37.82,37.82,0,0,0-5.32-.34,33.52,33.52,0,0,0-17.54,4.1v50.82a2,2,0,0,1-2,2H555.8a2,2,0,0,1-2-2V785.71a2,2,0,0,1,2-2h5.69a2,2,0,0,1,1.77,1h0l2,4.53a34.76,34.76,0,0,1,21.64-7.11,32.17,32.17,0,0,1,5.37.45h0c1,0,1.86,1.7,1.86,2.79v8.2a2,2,0,0,1-2,2h-.16"/><path fill="#3544b1" d="M631.28,820.51c-6.8.82-10.83,3.4-10.83,10.54,0,5.21,2.26,10.13,10.53,10.13a25.2,25.2,0,0,0,14.66-4.54V818.93Zm18.12,26.15a33.22,33.22,0,0,1-20.66,7.11c-17.67,0-23.54-10.94-23.54-21.91,0-14.79,9.58-21.09,25.06-22.31l15.34-1.23V804.9c0-7-3.29-9.72-13.42-9.72a57.41,57.41,0,0,0-18.69,3.13,2.22,2.22,0,0,1-.63,0,2,2,0,0,1-2-2v-9.06a2,2,0,0,1,1.31-1.93h0a65.46,65.46,0,0,1,21.14-3.42c22.45,0,27.64,9.85,27.64,24.38v43.68a2,2,0,0,1-2,2h-5.68a2,2,0,0,1-1.77-1h0Z"/><path fill="#3544b1" d="M727.41,838a2.08,2.08,0,0,1,.61,0,2,2,0,0,1,2,2v9.08a2,2,0,0,1-1.24,1.88h0a49.24,49.24,0,0,1-17.63,2.88c-24.24,0-31.72-14.52-31.72-35.87s7.41-35.86,31.72-35.86a48.74,48.74,0,0,1,17.51,2.76h0a2,2,0,0,1,1.27,1.9v9.07a2,2,0,0,1-2,2,3.53,3.53,0,0,1-.65,0h0A47,47,0,0,0,712,795.68c-13.28,0-17.13,9.06-17.13,22.32s3.85,22.31,17.13,22.31a46.81,46.81,0,0,0,15.27-2.26"/></svg>`;


// Inline SVG glyphs because Umbraco's icon registry has no plain "minus":
// `icon-remove` is a trash can. Pair both buttons with matching stroke glyphs so
// they render identically across themes regardless of the icon set.
const ZOOM_MINUS_SVG = /* html */ `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ZOOM_PLUS_SVG = /* html */ `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const zoomControlsTemplate = document.createElement('template');
zoomControlsTemplate.innerHTML = /* html */ `
	<div class="preview-zoom-controls">
		<button id="asset-zoom-out" type="button">${ZOOM_MINUS_SVG}</button>
		<button id="asset-zoom-in" type="button">${ZOOM_PLUS_SVG}</button>
	</div>
`;

const buildZoomControls = (localize: LeLøginScreenLocaliser, zoom: number): HTMLElement => {
	const zoomInLabel = localize.term('loginScreen_zoomIn');
	const zoomOutLabel = localize.term('loginScreen_zoomOut');
	const canZoomIn = zoom < ZOOM_MAX;
	const canZoomOut = zoom > ZOOM_MIN;
	const fragment = cloneTemplate(zoomControlsTemplate, 'zoom controls');
	const controls = queryRequired(fragment, '.preview-zoom-controls', isHtmlElement, 'zoom controls');
	const zoomOutButton = queryRequired(controls, '#asset-zoom-out', isHtmlElement, 'zoom out button');
	zoomOutButton.setAttribute('aria-label', zoomOutLabel);
	if (zoomOutButton instanceof HTMLButtonElement) {
		zoomOutButton.disabled = !canZoomOut;
	}
	const zoomInButton = queryRequired(controls, '#asset-zoom-in', isHtmlElement, 'zoom in button');
	zoomInButton.setAttribute('aria-label', zoomInLabel);
	if (zoomInButton instanceof HTMLButtonElement) {
		zoomInButton.disabled = !canZoomIn;
	}
	return controls;
};

const buildPreviewOverlay = ({
	localize,
	asset,
	logoAssets,
	greetingText,
	selectedLogoAssetId,
	zoom,
	}: LoadedWorkspaceBodyArgs): Array<HTMLElement> => {
	if (!isBackgroundLoginImageAsset(asset)) {
		return [];
	}

	return [
		buildLogoPickerControl(localize, logoAssets, selectedLogoAssetId),
		buildGreetingField(localize, greetingText),
		buildZoomControls(localize, zoom),
	];
};

const buildGreetingField = (localize: LeLøginScreenLocaliser, greetingText: string): HTMLElement => {
	const fragment = cloneTemplate(greetingFieldTemplate, 'greeting field');
	const control = queryRequired(fragment, '.preview-greeting-field', isHtmlElement, 'greeting field');
	const input = queryRequired(control, '#asset-greeting-inline', isTextInputElement, 'greeting input');
	input.setAttribute('label', localize.term('loginScreen_greetingText'));
	input.value = greetingText;
	return control;
};

const buildPreview = ({
	localize,
	asset,
	previewUrl,
	logoAssets,
	greetingText,
	selectedLogoAssetId,
	zoom,
	}: LoadedWorkspaceBodyArgs): HTMLElement => {
	if (isLogoLoginImageAsset(asset)) {
		const fragment = cloneTemplate(logoPreviewTemplate, 'logo preview');
		const image = queryRequired(fragment, '.logo-preview-image', isHtmlImageElement, 'logo preview image');
		if (previewUrl !== undefined) {
			image.src = previewUrl;
		}
		return image;
	}

	const fragment = cloneTemplate(previewStageTemplate, 'preview stage');
	const stage = queryRequired(fragment, '.preview-stage', isHtmlElement, 'preview stage');
	const overlay = queryRequired(stage, '#preview-overlay', isHtmlElement, 'preview overlay');
	overlay.replaceChildren(...buildPreviewOverlay({
		localize,
		asset,
		previewUrl,
		logoAssets,
		greetingText,
		selectedLogoAssetId,
		zoom,
	}));
	return stage;
};

const buildLoadingBody = (): Array<HTMLElement> => {
	const panel = buildWorkspacePanel();
	panel.body.append(document.createElement('uui-loader-circle'));
	return [panel.root];
};

const buildEmptyBody = (localize: LeLøginScreenLocaliser): Array<HTMLElement> => {
	const panel = buildWorkspacePanel();
	const message = document.createElement('p');
	message.className = 'empty-state';
	message.textContent = localize.term('loginScreen_assetNotFound');
	panel.body.append(message);
	return [panel.root];
};

const buildLoadedBody = ({
	localize,
	asset,
	previewUrl,
	logoAssets,
	greetingText,
	selectedLogoAssetId,
	zoom,
	}: LoadedWorkspaceBodyArgs): Array<HTMLElement> => {
	const panel = buildWorkspacePanel();
	panel.body.append(
		buildPreview({
			localize,
			asset,
			previewUrl,
			logoAssets,
			greetingText,
			selectedLogoAssetId,
			zoom,
		}),
	);
	return [panel.root];
};

export const buildWorkspaceBody = ({
	localize,
	isLoading,
	asset,
	previewUrl,
	logoAssets,
	greetingText,
	selectedLogoAssetId,
	zoom,
	}: AssetWorkspaceBodyArgs): Array<HTMLElement> => {
	if (isLoading) {
		return buildLoadingBody();
	}

	if (asset === null) {
		return buildEmptyBody(localize);
	}

	return buildLoadedBody({
		localize,
		asset,
		previewUrl,
		logoAssets,
		greetingText,
		selectedLogoAssetId,
		zoom,
	});
};

export function measureLogoPosition(authPreview: HTMLElement): { leftPct: number; topPct: number } | null {
	const logoEl =
		authPreview.shadowRoot?.getElementById('logo-on-image') ??
		authPreview.shadowRoot?.getElementById('logo-on-background');
	if (!(logoEl instanceof HTMLElement)) return null;
	const stageRect = authPreview.getBoundingClientRect();
	if (stageRect.width === 0 || stageRect.height === 0) return null;
	const logoRect = logoEl.getBoundingClientRect();
	return {
		leftPct: ((logoRect.left + logoRect.width / 2 - stageRect.left) / stageRect.width) * 100,
		topPct: ((logoRect.top + logoRect.height / 2 - stageRect.top) / stageRect.height) * 100,
	};
}

export function measureGreetingPosition(authPreview: HTMLElement): { leftPct: number; topPct: number } | null {
	const greetingEl = authPreview.shadowRoot?.getElementById('greeting');
	if (!(greetingEl instanceof HTMLElement)) return null;
	const stageRect = authPreview.getBoundingClientRect();
	if (stageRect.width === 0 || stageRect.height === 0) return null;
	const greetingRect = greetingEl.getBoundingClientRect();
	return {
		leftPct: ((greetingRect.left + greetingRect.width / 2 - stageRect.left) / stageRect.width) * 100,
		topPct: ((greetingRect.top + greetingRect.height / 2 - stageRect.top) / stageRect.height) * 100,
	};
}

export { computeFocalPointFromDrag } from './focal-point-drag.js';
