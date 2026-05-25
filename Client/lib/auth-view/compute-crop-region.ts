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
 * The window is `1/zoom × 1/zoom` of the original image, centred on the focal
 * point and clamped to [0, 1]. When the focal point sits near an edge the clamp
 * shifts one side: the window becomes asymmetric and its aspect ratio differs
 * from the original — that's exactly what the server produces and what the
 * editor must reproduce to stay WYSIWYG.
 *
 * Returns the full image `(0, 0)–(1, 1)` for any zoom ≤ 1 (or non-finite) so
 * callers can plug the result straight into cover-fit maths regardless of
 * whether a zoom is configured.
 */
export const computeCropRegion = (
	focalPoint: FocalPoint | undefined,
	zoom: number | undefined
): CropRegion => {
	const z = typeof zoom === 'number' && Number.isFinite(zoom) && zoom > ZOOM_NOOP_THRESHOLD
		? zoom
		: 1;
	if (z === 1) {
		return { x1: 0, y1: 0, x2: 1, y2: 1 };
	}
	const fp = focalPoint ?? { left: 0.5, top: 0.5 };
	const half = 0.5 / z;
	return {
		x1: Math.max(0, fp.left - half),
		y1: Math.max(0, fp.top - half),
		x2: Math.min(1, fp.left + half),
		y2: Math.min(1, fp.top + half)
	};
};
