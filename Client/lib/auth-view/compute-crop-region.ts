import type { FocalPoint } from '../models/index.js';

export interface CropRegion {
	/** Left edge of the crop in normalised image coordinates (0–1). */
	readonly x1: number;
	/** Top edge of the crop in normalised image coordinates (0–1). */
	readonly y1: number;
	/** Right edge of the crop in normalised image coordinates (0–1). */
	readonly x2: number;
	/** Bottom edge of the crop in normalised image coordinates (0–1). */
	readonly y2: number;
}

/** No-op tolerance matches `LoginScreenImageUrlBuilder.ApplyImageProcessing` so the
 *  client and server agree on which zoom values are treated as "no crop". */
const ZOOM_NOOP_THRESHOLD = 1.001;

/**
 * Computes the normalised crop window for a focal point + zoom pair, mirroring
 * the server-side `cc=` window built by
 * {@link ../../Core/Runtime/LoginScreenImageUrlBuilder.cs} so the editor preview
 * can render the same visible pixels without a server round-trip.
 *
 * The window is always `1/zoom × 1/zoom` of the original image — the focal
 * point is clamped to `[half, 1 − half]` before centring so the window can never
 * be clipped to a smaller area at the edges. Clipping the window shrinks the
 * crop, which the cover-fit then has to scale up more to fill the panel, and
 * the result reads as "the zoom changed while I was panning" to anyone dragging
 * the focal point near an edge.
 *
 * Returns the full image `(0, 0)–(1, 1)` for any zoom ≤ 1 (or non-finite) so
 * callers can plug the result straight into cover-fit maths regardless of
 * whether a zoom is configured.
 */
export const computeCropRegion = (
	focalPoint: FocalPoint | undefined,
	zoom: number | undefined
): CropRegion => {
	const z =
		typeof zoom === 'number' && Number.isFinite(zoom) && zoom > ZOOM_NOOP_THRESHOLD ? zoom : 1;
	if (z === 1) {
		return { x1: 0, y1: 0, x2: 1, y2: 1 };
	}
	const fp = focalPoint ?? { left: 0.5, top: 0.5 };
	const half = 0.5 / z;
	const left = clamp(fp.left, half, 1 - half);
	const top = clamp(fp.top, half, 1 - half);
	return {
		x1: left - half,
		y1: top - half,
		x2: left + half,
		y2: top + half
	};
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
