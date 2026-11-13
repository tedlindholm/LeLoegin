/**
 * Pure focal-point and zoom math for the login screen asset editor.
 *
 * Lives in its own module (no Umbraco imports) so it can be tested directly via
 * Vitest without dragging in transitive dependencies that fail under Node's ESM loader.
 */

/** A normalised focal point: 0 is the left or top edge of the image, 1 the right or bottom. */
export interface FocalPointLike {
	/** Horizontal position, 0–1. */
	left: number;
	/** Vertical position, 0–1. */
	top: number;
}

/** Arguments to {@link computeFocalPointFromDrag}. */
export interface ComputeFocalPointFromDragArgs {
	/** Natural pixel dimensions of the source image. */
	image: { width: number; height: number };
	/** Pixel dimensions of the visible preview container. */
	container: { width: number; height: number };
	/** Focal point at the moment the drag started. */
	startFocalPoint: FocalPointLike;
	/** Horizontal drag delta in container pixels since the drag started. */
	deltaX: number;
	/** Vertical drag delta in container pixels since the drag started. */
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
 * Geometric derivation:
 * - At zoom = 1 (`background-size: cover` on `#graphic`), `background-position: x%` places
 *   the image edge at `-x * (coverScaledWidth - containerWidth)`, so a unit focal-point shift
 *   pans by `coverScaledWidth - containerWidth`.
 * - At zoom > 1 (`crop-preview.ts`), the preview paints the image at `coverScaledWidth * Z`
 *   and centres the crop window (`container / 2 - cropCentre * paintedSize`), so a unit
 *   focal-point shift pans by the full `coverScaledWidth * Z`.
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
	// Reject empty sizes and non-finite deltas so NaN can never propagate into the focal point.
	if (!hasArea(image) || !hasArea(container) || !Number.isFinite(deltaX + deltaY)) {
		return startFocalPoint;
	}
	const z = zoom !== undefined && Number.isFinite(zoom) ? Math.max(1, zoom) : 1;
	const scaled = coverScaledSize(image, container);

	// When zoomed the focal point is constrained to [half, 1−half] so the crop
	// window stays a symmetric 1/zoom × 1/zoom; clamping the drag output to the
	// same range keeps the cursor honest (otherwise it would slide past the edge
	// while the visible image stops moving). At zoom=1 there's no crop window so
	// the rxy= focal-point hint can use the full [0, 1] range.
	const half = 0.5 / z;
	const bounds = z > 1 ? { min: half, max: 1 - half } : { min: 0, max: 1 };
	const panRangeX = z > 1 ? scaled.width * z : scaled.width - container.width;
	const panRangeY = z > 1 ? scaled.height * z : scaled.height - container.height;

	return {
		left: dragAxis(startFocalPoint.left, deltaX, panRangeX, bounds),
		top: dragAxis(startFocalPoint.top, deltaY, panRangeY, bounds)
	};
}

interface Size {
	width: number;
	height: number;
}

const hasArea = (size: Size) => size.width > 0 && size.height > 0;

/** Size of the image once `background-size: cover` has scaled it to fill the container. */
function coverScaledSize(image: Size, container: Size): Size {
	const imageAspect = image.width / image.height;
	return imageAspect > container.width / container.height
		? { width: container.height * imageAspect, height: container.height }
		: { width: container.width, height: container.width / imageAspect };
}

/** Moves one focal-point axis by a drag delta; an axis with no overflow cannot move. */
function dragAxis(
	start: number,
	delta: number,
	overflow: number,
	bounds: { min: number; max: number }
): number {
	if (overflow <= 0) return start;
	return clamp(clamp(start, bounds.min, bounds.max) - delta / overflow, bounds.min, bounds.max);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
