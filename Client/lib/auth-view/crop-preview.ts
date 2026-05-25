import { computeCropRegion } from './compute-crop-region.js';

export interface CropPreviewInputs {
	imageUrl: string;
	imageWidth: number;
	imageHeight: number;
	focalPoint?: { left: number; top: number };
	zoom?: number;
}

const CROP_PREVIEW_WRAPPER_ID = 'le-login-crop-preview';

/**
 * Renders the editor preview through the same maths ImageSharp.Web applies at
 * runtime: `cc=` crop window + center/cover scaling. The earlier implementation
 * applied a CSS `scale()` transform to the uncropped image, which kept the focal
 * point at `fp%` of the panel — but the server's clamped crop centres the *clamped*
 * window instead, so the two diverged hard as soon as the focal point neared an
 * image edge.
 *
 * Strategy: paint the uncropped thumbnail at the size it would have if its crop
 * region were cover-fitted to the panel, then position it so the crop centre lands
 * at the panel centre. The visible pixels match what runtime would deliver, with no
 * server round-trip and no extra dependency on image load events.
 *
 * The wrapper is prepended to `#graphic`, which already has `overflow: hidden` and
 * `position: relative` in Umbraco's auth view shadow DOM — siblings like
 * `#logo-on-image` and the SVG curves stay at their original positions and only the
 * background paint is replaced.
 */
interface CropPreviewPaint {
	paintedW: number;
	paintedH: number;
	bpX: number;
	bpY: number;
}

const cropPreviewPaint = (
	inputs: CropPreviewInputs,
	panelW: number,
	panelH: number
): CropPreviewPaint | undefined => {
	const crop = computeCropRegion(inputs.focalPoint, inputs.zoom);
	const cropPxW = (crop.x2 - crop.x1) * inputs.imageWidth;
	const cropPxH = (crop.y2 - crop.y1) * inputs.imageHeight;
	if (cropPxW <= 0 || cropPxH <= 0) return undefined;

	// Cover scale on the crop region — the same `max(W/cropW, H/cropH)` the browser
	// would compute for the server-cropped image at runtime.
	const coverScale = Math.max(panelW / cropPxW, panelH / cropPxH);
	const paintedW = inputs.imageWidth * coverScale;
	const paintedH = inputs.imageHeight * coverScale;
	const cropCentreX = (crop.x1 + crop.x2) / 2;
	const cropCentreY = (crop.y1 + crop.y2) / 2;
	return {
		paintedW,
		paintedH,
		bpX: backgroundPositionFraction(cropCentreX, paintedW, panelW),
		bpY: backgroundPositionFraction(cropCentreY, paintedH, panelH)
	};
};

const ensureCropPreviewWrapper = (graphic: HTMLElement, existing: Element | null): HTMLElement => {
	if (existing instanceof HTMLElement) return existing;
	const wrapper = document.createElement('div');
	wrapper.id = CROP_PREVIEW_WRAPPER_ID;
	wrapper.style.position = 'absolute';
	wrapper.style.inset = '0';
	wrapper.style.backgroundRepeat = 'no-repeat';
	graphic.prepend(wrapper);
	return wrapper;
};

export const applyCropPreview = (
	shadowRoot: ShadowRoot,
	inputs: CropPreviewInputs | undefined
) => {
	const graphic = shadowRoot.getElementById('graphic');
	if (!(graphic instanceof HTMLElement)) return;

	const existingWrapper = graphic.querySelector(`#${CROP_PREVIEW_WRAPPER_ID}`);

	// Bail (and clear the wrapper) for inactive previews, missing layout, or any
	// crop region that doesn't actually have pixels to paint.
	const panelW = graphic.clientWidth;
	const panelH = graphic.clientHeight;
	const paint = isCropPreviewActive(inputs) && panelW > 0 && panelH > 0
		? cropPreviewPaint(inputs, panelW, panelH)
		: undefined;
	if (paint === undefined || !isCropPreviewActive(inputs)) {
		existingWrapper?.remove();
		return;
	}

	const wrapper = ensureCropPreviewWrapper(graphic, existingWrapper);
	wrapper.style.backgroundImage = `url("${escapeBackgroundUrl(inputs.imageUrl)}")`;
	wrapper.style.backgroundSize = `${paint.paintedW.toFixed(2)}px ${paint.paintedH.toFixed(2)}px`;
	wrapper.style.backgroundPosition = `${(paint.bpX * 100).toFixed(4)}% ${(paint.bpY * 100).toFixed(4)}%`;
};

const isCropPreviewActive = (inputs: CropPreviewInputs | undefined): inputs is CropPreviewInputs =>
	inputs !== undefined &&
	typeof inputs.imageUrl === 'string' &&
	inputs.imageUrl.length > 0 &&
	Number.isFinite(inputs.imageWidth) &&
	Number.isFinite(inputs.imageHeight) &&
	inputs.imageWidth > 0 &&
	inputs.imageHeight > 0 &&
	typeof inputs.zoom === 'number' &&
	Number.isFinite(inputs.zoom) &&
	inputs.zoom > 1.001;

/**
 * Resolves the CSS background-position fraction (0–1) that lands the supplied
 * crop-centre coordinate at the centre of the panel.
 *
 * Falls back to 0.5 when the painted dimension exactly matches the panel
 * dimension — there's no room to shift, so any value renders the same pixels.
 */
const backgroundPositionFraction = (
	cropCentre: number,
	paintedSize: number,
	panelSize: number
): number => {
	const denom = paintedSize - panelSize;
	if (denom <= 0) return 0.5;
	return (cropCentre * paintedSize - panelSize / 2) / denom;
};

const escapeBackgroundUrl = (value: string) => value.replaceAll('"', '%22');
