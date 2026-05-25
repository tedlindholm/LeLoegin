import { toLoginImageBackground } from './login-image-background.js';
import { applyCropPreview } from './crop-preview.js';

export interface LoginAuthViewCustomisation {
	imageUrl?: string;
	greetingText?: string;
	logoUrl?: string;
	hideGreeting?: boolean;
	mode?: 'runtime' | 'preview';
	previewHeight?: string;
	/**
	 * Normalised focal point (0–1) used to position the background image in preview mode.
	 * Runtime callers omit this — the URL is already cropped to focal point by ImageSharp.Web.
	 */
	focalPoint?: { left: number; top: number };
	/**
	 * Zoom factor (≥ 1.0) for the editor preview. When `imageWidth` and `imageHeight` are
	 * also supplied the customiser simulates ImageSharp's server-side `cc=` crop entirely
	 * in CSS, so the preview stays pixel-identical to what runtime will paint. Runtime
	 * callers omit zoom — their URL is already cropped.
	 */
	zoom?: number;
	/**
	 * Natural pixel width of the uncropped image. Required (together with `imageHeight`)
	 * for the editor's WYSIWYG crop simulation; omit for runtime callers and for the
	 * dashboard preview, which receive an already-cropped URL.
	 */
	imageWidth?: number;
	/** Natural pixel height of the uncropped image. See {@link imageWidth}. */
	imageHeight?: number;
}

const PREVIEW_PROVIDER_STYLE_ID = 'le-løgin-preview-style';
const PREVIEW_PROVIDER_NOTE_ID = 'le-løgin-preview-note';

const setOptionalText = (element: HTMLElement | null, value: string | undefined) => {
	if (element === null || value === undefined || element.textContent === value) {
		return;
	}

	element.textContent = value;
};

const setOptionalImageSource = (element: Element | null, value: string | undefined) => {
	if (!(element instanceof HTMLImageElement)) {
		return;
	}

	if (value === undefined) {
		// Clear the previous preview logo when the caller explicitly removes it.
		// Without this, the editor keeps rendering the last selected logo because
		// the existing <img src> survives across subsequent customisation passes.
		element.removeAttribute('src');
		element.style.visibility = 'hidden';
		return;
	}

	element.style.visibility = '';

	// Compare against the content attribute, not the IDL property: `.src` returns an
	// absolute URL ("http://host/foo.png") so an equality check against the relative
	// value the caller supplies ("/foo.png") never matches — and reassigning `.src`
	// re-triggers an image load, which makes the logo flash on every keystroke.
	if (element.getAttribute('src') === value) {
		return;
	}

	element.src = value;
};

const setPreviewHostLayout = (
	authView: HTMLElement,
	shadowRoot: ShadowRoot,
	previewHeight: string
) => {
	authView.style.display = 'block';
	authView.style.width = '100%';
	authView.style.maxWidth = '100%';
	// The host needs an explicit height so `#layout`'s `height: 100%` (below) can
	// resolve when callers pass a percentage-based preview height. The host's own
	// :host CSS provides flex layout but no height.
	authView.style.height = '100%';
	authView.style.pointerEvents = 'none';
	authView.style.userSelect = 'none';

	const layout = shadowRoot.getElementById('layout');
	if (layout instanceof HTMLElement) {
		layout.style.width = '100%';
		layout.style.maxWidth = '100%';
		layout.style.height = previewHeight;
	}

	const graphic = shadowRoot.getElementById('graphic');
	if (graphic instanceof HTMLElement) {
		graphic.style.minHeight = `calc(${previewHeight} - 64px)`;
	}

	const contentContainer = shadowRoot.getElementById('content-container');
	if (contentContainer instanceof HTMLElement) {
		contentContainer.style.height = '100%';
	}
};

const ensurePreviewProviderStyles = (shadowRoot: ShadowRoot) => {
	if (shadowRoot.getElementById(PREVIEW_PROVIDER_STYLE_ID) !== null) {
		return;
	}

	const style = document.createElement('style');
	style.id = PREVIEW_PROVIDER_STYLE_ID;
	style.textContent = `
		#providers {
			opacity: 0.72;
		}

		#providers,
		#providers * {
			pointer-events: none;
		}

		#${PREVIEW_PROVIDER_NOTE_ID} {
			font-size: var(--uui-type-small-size);
			color: var(--uui-color-text-alt);
			text-align: center;
			margin-top: var(--uui-size-space-3);
		}
	`;
	shadowRoot.append(style);
};

const disableInteractiveElements = (root: ParentNode) => {
	const interactiveElements = root.querySelectorAll(
		'button, input, select, textarea, uui-button, uui-input'
	);

	interactiveElements.forEach((element) => {
		if (
			element instanceof HTMLButtonElement ||
			element instanceof HTMLInputElement ||
			element instanceof HTMLSelectElement ||
			element instanceof HTMLTextAreaElement
		) {
			element.disabled = true;
			return;
		}

		if (element instanceof HTMLElement) {
			element.setAttribute('disabled', '');
			element.setAttribute('aria-disabled', 'true');
			element.tabIndex = -1;
		}
	});

	root.querySelectorAll('*').forEach((element) => {
		if (!(element instanceof HTMLElement) || element.shadowRoot === null) {
			return;
		}

		disableInteractiveElements(element.shadowRoot);
	});
};

const ensurePreviewProviders = (shadowRoot: ShadowRoot) => {
	const providers = shadowRoot.getElementById('providers');
	if (!(providers instanceof HTMLElement)) {
		return;
	}

	ensurePreviewProviderStyles(shadowRoot);
	providers.setAttribute('inert', '');
	providers.setAttribute('aria-disabled', 'true');
	providers.tabIndex = -1;
	disableInteractiveElements(providers);

	let previewNote = shadowRoot.getElementById(PREVIEW_PROVIDER_NOTE_ID);
	if (!(previewNote instanceof HTMLElement)) {
		previewNote = document.createElement('div');
		previewNote.id = PREVIEW_PROVIDER_NOTE_ID;
		previewNote.textContent = 'Preview only';
		providers.insertAdjacentElement('afterend', previewNote);
	}
};

// Crop simulation that mirrors runtime's ImageSharp `cc=` + center/cover output
// lives in `./crop-preview.ts`. It's applied only when the caller is in preview
// mode and supplies image dimensions.

export const applyAuthViewCustomisation = (
	authView: HTMLElement,
	customisation: LoginAuthViewCustomisation
) => {
	if (customisation.imageUrl !== undefined) {
		authView.style.setProperty(
			'--umb-login-image',
			toLoginImageBackground(customisation.imageUrl, customisation.focalPoint)
		);
	}

	const shadowRoot = authView.shadowRoot;
	if (shadowRoot === null) {
		return;
	}

	const greeting =
		shadowRoot.getElementById('greeting') instanceof HTMLElement
			? shadowRoot.getElementById('greeting')
			: null;
	const hidden = customisation.hideGreeting === true;

	setOptionalText(
		greeting,
		customisation.greetingText
	);
	if (greeting instanceof HTMLElement) {
		greeting.style.visibility = hidden ? 'hidden' : '';
		greeting.style.opacity = !hidden && customisation.greetingText === undefined ? '0.38' : '';
	}
	setOptionalImageSource(shadowRoot.getElementById('logo-on-image'), customisation.logoUrl);
	setOptionalImageSource(shadowRoot.getElementById('logo-on-background'), customisation.logoUrl);

	if (customisation.mode === 'preview') {
		applyPreviewMode(authView, shadowRoot, customisation);
	} else {
		// Tear down preview-only state when callers switch back to runtime mode.
		applyCropPreview(shadowRoot, undefined);
		authView.style.clipPath = '';
	}
};

const applyPreviewMode = (
	authView: HTMLElement,
	shadowRoot: ShadowRoot,
	customisation: LoginAuthViewCustomisation
) => {
	setPreviewHostLayout(authView, shadowRoot, customisation.previewHeight ?? '100%');
	ensurePreviewProviders(shadowRoot);
	applyCropPreview(shadowRoot, toCropPreviewInputs(customisation));
	// Defensive: `#graphic`'s own overflow:hidden already clips the preview wrapper.
	// clip-path on the host is a belt-and-braces guard in case any future Umbraco
	// change adds an absolutely-positioned descendant that escapes the panel.
	authView.style.clipPath = 'inset(0)';
};

const toCropPreviewInputs = (customisation: LoginAuthViewCustomisation) => {
	if (customisation.imageUrl === undefined) return undefined;
	return {
		imageUrl: customisation.imageUrl,
		imageWidth: customisation.imageWidth ?? Number.NaN,
		imageHeight: customisation.imageHeight ?? Number.NaN,
		...(customisation.focalPoint === undefined ? {} : { focalPoint: customisation.focalPoint }),
		...(customisation.zoom === undefined ? {} : { zoom: customisation.zoom })
	};
};

// Reactive observation of the auth view (mutation observer + ResizeObserver) lives
// in `./auth-view-observation.ts`. It's re-exported from there so existing callers
// keep importing from this module.
export { observeAuthViewCustomisation } from './auth-view-observation.js';
