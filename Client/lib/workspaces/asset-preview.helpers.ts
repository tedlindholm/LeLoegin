import type { FocalPoint } from '../models/index.ts';

// Spreadable optional field — collapses the noisy `...(x === undefined ? {} : { foo: x })`
// pattern at the call site so the customisation object reads like a flat record.
const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => {
	const field: Partial<Record<K, V>> = {};
	if (value !== undefined) field[key] = value;
	return field;
};

/** The background asset draft the asset workspace previews. */
export interface BackgroundPreviewDraft {
	/** URL of the background image, once it is known. */
	imageUrl: string | undefined;
	/** Greeting shown over the login form, if any. */
	greetingText: string | undefined;
	/** URL of the logo paired with the background, if any. */
	logoUrl: string | undefined;
	/** Normalised (0–1) focal point the crop centres on. */
	focalPoint: FocalPoint | undefined;
	/** Zoom factor; 1 means no zoom and is left out of the customisation. */
	zoom: number;
	/** Natural width of the image in pixels; missing for legacy assets. */
	imageWidth: number | undefined;
	/** Natural height of the image in pixels; missing for legacy assets. */
	imageHeight: number | undefined;
}

/**
 * Builds the auth view customisation for the asset workspace preview. Pass `undefined`
 * when no background asset is loaded, for example while editing a logo.
 *
 * @param draft - The background draft to preview, or `undefined` for a preview with no image.
 * @param previewNote - Note shown on the preview to mark it as not the live login screen.
 * @returns The customisation to apply to the preview `umb-auth-view`.
 */
export function buildAssetPreviewCustomisation(
	draft: BackgroundPreviewDraft | undefined,
	previewNote: string
) {
	const base = { mode: 'preview' as const, previewHeight: '100%', previewNote };
	if (draft === undefined) return base;
	// Image dimensions feed the crop+cover simulation in auth-view-customiser so the
	// editor previews the exact pixels ImageSharp.Web will produce at runtime. Missing
	// dimensions (legacy assets) leave the preview in the simpler fp%+cover fallback.
	return {
		...optional('imageUrl', draft.imageUrl),
		...optional('greetingText', draft.greetingText),
		...optional('logoUrl', draft.logoUrl),
		...optional('focalPoint', draft.focalPoint),
		...optional('zoom', draft.zoom > 1 ? draft.zoom : undefined),
		...optional('imageWidth', draft.imageWidth),
		...optional('imageHeight', draft.imageHeight),
		hideGreeting: true,
		...base
	};
}

/**
 * Calls `onLayout` once per animation frame after the auth view's shadow tree changes.
 *
 * @param authPreview - The preview auth view element to watch.
 * @param onLayout - Called, at most once per frame, after a relevant change.
 * @returns A function that stops observing, or `undefined` when the element has no shadow root yet.
 */
export function observeAuthPreviewLayout(authPreview: HTMLElement, onLayout: () => void) {
	const shadowRoot = authPreview.shadowRoot;
	if (shadowRoot === null) return undefined;
	let rafHandle: number | undefined;
	const observer = new MutationObserver(() => {
		if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
		rafHandle = requestAnimationFrame(() => {
			rafHandle = undefined;
			onLayout();
		});
	});
	// Don't watch 'style' mutations: applyCropPreview writes background-position
	// on every pointer-move during a drag, and watching style here turned each
	// move into a forced-layout re-positioning pass (the overlays themselves
	// then set CSS vars, which fed the loop). Host size changes are picked up
	// by the ResizeObserver inside observeAuthViewCustomisation instead.
	observer.observe(shadowRoot, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['src', 'hidden', 'class']
	});
	return () => {
		observer.disconnect();
		if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
	};
}

export function measureGreetingPosition(authPreview: HTMLElement) {
	return measureCentre(authPreview, authPreview.shadowRoot?.getElementById('greeting'));
}

/** Centre of an element inside the auth preview, as percentages of the preview's size. */
function measureCentre(
	authPreview: HTMLElement,
	element: Element | null | undefined
): { leftPct: number; topPct: number } | null {
	if (!(element instanceof HTMLElement)) return null;
	const stageRect = authPreview.getBoundingClientRect();
	if (stageRect.width === 0 || stageRect.height === 0) return null;
	const rect = element.getBoundingClientRect();
	return {
		leftPct: ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 100,
		topPct: ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 100
	};
}

/**
 * Finds where the greeting sits in the auth preview, for placing the greeting overlay.
 *
 * @param authPreview - The preview auth view element.
 * @returns The greeting's centre as percentages of the preview's size, or `null` when there is
 * no greeting or the preview has no size.
 */
