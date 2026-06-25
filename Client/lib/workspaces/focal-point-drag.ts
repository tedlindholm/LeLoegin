/**
 * Pure focal-point and zoom math for the login screen asset editor.
 *
 * Lives in its own module (no Umbraco imports) so it can be tested directly via
 * Vitest without dragging in transitive dependencies that fail under Node's ESM loader.
 */

export interface FocalPointLike {
	left: number;
	top: number;
}

export interface ComputeFocalPointFromDragArgs {
	image: { width: number; height: number };
	container: { width: number; height: number };
	startFocalPoint: FocalPointLike;
	deltaX: number;
	deltaY: number;
	/**
	 * Zoom factor currently applied to the preview (≥ 1).
	 * Scales the effective image size so that axes locked at zoom=1 (no overflow)
	 * become draggable once the image is zoomed in. Non-finite values fall back to 1.
	 */
	zoom?: number;
}

/**
 * Translates a pointer drag inside a `background-size: cover` preview into updated
 * normalised focal-point coordinates.
 *
 * With `cover` the image is scaled so one axis matches the container exactly and the
 * other overflows. Only the overflowing axis can shift visually — a drag along the
 * locked axis is a no-op. `background-position: x% y%` aligns the x%/y% point of the
 * image to the same point in the container, so dragging rightwards (positive deltaX)
 * means the user wants to see more of the left side, which decreases the percentage.
 *
 * Geometric derivation (with zoom Z applied via the wrapper transform):
 * - Visible-window-center shift in wrapper space per Δfp = W × (1 − 1/Z)
 * - Image-within-wrapper shift per Δfp = (cover-scaled-width − W)
 * - Both effects render at scale Z on screen → total screen pan = scaledWidth × Z − W
 *
 * That's `overflowX` below, and the formula is exact (not approximate).
 *
 * @param args.image - Natural pixel dimensions of the source image.
 * @param args.container - Pixel dimensions of the visible preview container.
 * @param args.startFocalPoint - Focal point at the moment the drag started (0–1).
 * @param args.deltaX - Horizontal drag delta in container pixels since drag start.
 * @param args.deltaY - Vertical drag delta in container pixels since drag start.
 * @param args.zoom - Optional zoom factor (≥ 1); non-finite values fall back to 1.
 * @returns Updated focal-point clamped to [0, 1] on each axis.
 */
export function computeFocalPointFromDrag({
	image,
	container,
	startFocalPoint,
	deltaX,
	deltaY,
	zoom
}: ComputeFocalPointFromDragArgs): FocalPointLike {
	if (image.width <= 0 || image.height <= 0 || container.width <= 0 || container.height <= 0) {
		return startFocalPoint;
	}

	// Reject non-finite deltas/zoom so NaN can never propagate into the focal point.
	if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
		return startFocalPoint;
	}
	const z = Number.isFinite(zoom) ? Math.max(1, zoom as number) : 1;

	const imageAspect = image.width / image.height;
	const containerAspect = container.width / container.height;

	let scaledWidth: number;
	let scaledHeight: number;
	if (imageAspect > containerAspect) {
		scaledHeight = container.height;
		scaledWidth = container.height * imageAspect;
	} else {
		scaledWidth = container.width;
		scaledHeight = container.width / imageAspect;
	}

	// Multiply by zoom so that axes with no overflow at zoom=1 become draggable once zoomed.
	const overflowX = Math.max(0, scaledWidth * z - container.width);
	const overflowY = Math.max(0, scaledHeight * z - container.height);

	// When zoomed the focal point is constrained to [half, 1−half] so the crop
	// window stays a symmetric 1/zoom × 1/zoom; clamping the drag output to the
	// same range keeps the cursor honest (otherwise it would slide past the edge
	// while the visible image stops moving). At zoom=1 there's no crop window so
	// the rxy= focal-point hint can use the full [0, 1] range.
	const half = 0.5 / z;
	const [minBound, maxBound] = z > 1 ? [half, 1 - half] : [0, 1];

	const left =
		overflowX > 0
			? clamp(startFocalPoint.left - deltaX / overflowX, minBound, maxBound)
			: startFocalPoint.left;
	const top =
		overflowY > 0
			? clamp(startFocalPoint.top - deltaY / overflowY, minBound, maxBound)
			: startFocalPoint.top;

	return { left, top };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
