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

export const applyCropPreview = (shadowRoot: ShadowRoot, inputs: CropPreviewInputs | undefined) => {
	const graphic = shadowRoot.getElementById('graphic');
	if (!(graphic instanceof HTMLElement)) return;

	const existingWrapper = graphic.querySelector(`#${CROP_PREVIEW_WRAPPER_ID}`);
	const resolved = resolveCropPreviewPaint(graphic, inputs);

	if (resolved === undefined) {
		teardownCropPreview(graphic, existingWrapper);
		return;
	}

	hideGraphicBackground(graphic);
	const wrapper = ensureCropPreviewWrapper(graphic, existingWrapper);
	paintCropPreview(wrapper, resolved.inputs, resolved.paint);
};

interface ResolvedCropPreview {
	readonly inputs: CropPreviewInputs;
	readonly paint: CropPreviewPaint;
}

const resolveCropPreviewPaint = (
	graphic: HTMLElement,
	inputs: CropPreviewInputs | undefined
): ResolvedCropPreview | undefined => {
	if (!isCropPreviewActive(inputs)) return undefined;
	const panelW = graphic.clientWidth;
	const panelH = graphic.clientHeight;
	if (panelW <= 0 || panelH <= 0) return undefined;
	const paint = cropPreviewPaint(inputs, panelW, panelH);
	return paint === undefined ? undefined : { inputs, paint };
};

const teardownCropPreview = (graphic: HTMLElement, existingWrapper: Element | null) => {
	existingWrapper?.remove();
	// Restore #graphic's own background (the uncropped --umb-login-image paint)
	// once the crop preview is no longer hiding it.
	graphic.style.background = '';
};

// Hide #graphic's own --umb-login-image paint while the wrapper is active. The
// wrapper sits on top of #graphic but its transparent pixels (PNGs with alpha)
// would otherwise reveal the uncropped cover-fit underneath, painting a ghost
// copy of the image at a different position. Runtime serves a single pre-cropped
// PNG from ImageSharp so this dual-paint never happens there.
const hideGraphicBackground = (graphic: HTMLElement) => {
	if (graphic.style.background !== 'none') {
		graphic.style.background = 'none';
	}
};

// Pan only changes the background position, but applyCropPreview runs on every
// pointer-move during a drag. Writing the URL and size on every move re-triggers
// style recalc (and on some browsers a redecode of the same image) which reads
// as "a bit jumpy" to anyone dragging. Only re-set each declaration when its
// value actually changes.
const paintCropPreview = (
	wrapper: HTMLElement,
	inputs: CropPreviewInputs,
	paint: CropPreviewPaint
) => {
	const nextImage = `url("${escapeBackgroundUrl(inputs.imageUrl)}")`;
	const nextSize = `${paint.paintedW.toFixed(2)}px ${paint.paintedH.toFixed(2)}px`;
	const nextPosition = `${(paint.bpX * 100).toFixed(4)}% ${(paint.bpY * 100).toFixed(4)}%`;
	if (wrapper.style.backgroundImage !== nextImage) {
		wrapper.style.backgroundImage = nextImage;
	}
	if (wrapper.style.backgroundSize !== nextSize) {
		wrapper.style.backgroundSize = nextSize;
	}
	if (wrapper.style.backgroundPosition !== nextPosition) {
		wrapper.style.backgroundPosition = nextPosition;
	}
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
