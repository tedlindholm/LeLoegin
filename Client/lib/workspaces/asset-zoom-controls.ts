import { cloneTemplate } from '../utils/template.js';

/** Lowest zoom factor a background can have: the uncropped cover fit. */
export const ZOOM_MIN = 1;
/** Highest zoom factor a background can have. */
export const ZOOM_MAX = 10;

interface Localiser {
	term(key: string): string;
}

const ZOOM_MINUS_SVG = /* html */ `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const ZOOM_PLUS_SVG = /* html */ `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

const zoomControlsTemplate = document.createElement('template');
zoomControlsTemplate.innerHTML = /* html */ `
	<uui-action-bar class="preview-zoom-controls">
		<uui-button id="asset-zoom-out" compact look="primary">${ZOOM_MINUS_SVG}</uui-button>
		<uui-button id="asset-zoom-in" compact look="primary">${ZOOM_PLUS_SVG}</uui-button>
	</uui-action-bar>
`;

function requireElement(root: ParentNode, selector: string): HTMLElement {
	const element = root.querySelector(selector);
	if (!(element instanceof HTMLElement)) {
		throw new Error(`Expected zoom control for selector "${selector}".`);
	}
	return element;
}

function setUpButton(button: HTMLElement, label: string, disabled: boolean) {
	button.setAttribute('label', label);
	button.toggleAttribute('disabled', disabled);
}

/**
 * Builds the zoom out / zoom in buttons over the background preview, disabled at the zoom limits.
 * The caller wires up the click handlers.
 *
 * @param localize - Supplies the buttons' localised labels.
 * @param zoom - The current zoom factor.
 * @returns The `uui-action-bar` holding both buttons.
 * @throws {Error} When the template is missing an expected element.
 */
export function buildZoomControls(localize: Localiser, zoom: number): HTMLElement {
	const controls = requireElement(
		cloneTemplate(zoomControlsTemplate, 'zoom controls'),
		'.preview-zoom-controls'
	);
	setUpButton(
		requireElement(controls, '#asset-zoom-out'),
		localize.term('loginScreen_zoomOut'),
		zoom <= ZOOM_MIN
	);
	setUpButton(
		requireElement(controls, '#asset-zoom-in'),
		localize.term('loginScreen_zoomIn'),
		zoom >= ZOOM_MAX
	);
	return controls;
}
