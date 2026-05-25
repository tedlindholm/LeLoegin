import { describe, expect, it } from 'vitest';
import { computeCropRegion, type CropRegion } from './compute-crop-region.js';

const expectClose = (actual: CropRegion, expected: CropRegion) => {
	// IEEE-754 means `0.3 − 0.25` is `0.04999999999999999`, not `0.05`. The server
	// formats `cc=` to four decimals, so any difference below 1e-12 is sub-pixel
	// and invisible to the preview maths — but assertions still need a tolerance.
	expect(actual.x1).toBeCloseTo(expected.x1, 12);
	expect(actual.y1).toBeCloseTo(expected.y1, 12);
	expect(actual.x2).toBeCloseTo(expected.x2, 12);
	expect(actual.y2).toBeCloseTo(expected.y2, 12);
};

describe('computeCropRegion', () => {
	it('returns the full image when zoom is undefined, ≤ 1, or non-finite', () => {
		const full = { x1: 0, y1: 0, x2: 1, y2: 1 };
		expect(computeCropRegion(undefined, undefined)).toEqual(full);
		expect(computeCropRegion({ left: 0.3, top: 0.6 }, 1)).toEqual(full);
		expect(computeCropRegion({ left: 0.3, top: 0.6 }, 0.5)).toEqual(full);
		expect(computeCropRegion({ left: 0.3, top: 0.6 }, Number.NaN)).toEqual(full);
	});

	it('treats zoom within 1.001 of 1 as a no-op (matches server tolerance)', () => {
		expect(computeCropRegion({ left: 0.3, top: 0.6 }, 1.0005)).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
	});

	// Pins the same input that LeLøgin.Tests/Api/Runtime/RuntimeControllerTests.cs uses
	// for "cc=0.05,0.35,0.45,0.15" — the editor and server must agree to four decimals
	// on this case or the preview drifts from runtime.
	it('matches the server cc= golden: fp=(0.3, 0.6), zoom=2', () => {
		expectClose(computeCropRegion({ left: 0.3, top: 0.6 }, 2), { x1: 0.05, y1: 0.35, x2: 0.55, y2: 0.85 });
	});

	it('returns a centred 1/zoom × 1/zoom window when the focal point is in the middle', () => {
		expectClose(computeCropRegion({ left: 0.5, top: 0.5 }, 2), { x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 });
		expectClose(computeCropRegion({ left: 0.5, top: 0.5 }, 4), { x1: 0.375, y1: 0.375, x2: 0.625, y2: 0.625 });
	});

	it('clamps one edge when the focal point is close to that edge — the very case that broke the editor', () => {
		// fp.left = 0.1 with zoom 2 → half=0.25 → unclamped x1=−0.15 → clamps to 0,
		// so the window becomes 0.35 wide instead of 0.5. Y is unaffected.
		expectClose(computeCropRegion({ left: 0.1, top: 0.5 }, 2), { x1: 0, y1: 0.25, x2: 0.35, y2: 0.75 });
	});

	it('clamps both edges when the focal point sits in a corner', () => {
		expectClose(computeCropRegion({ left: 0, top: 0 }, 4), { x1: 0, y1: 0, x2: 0.125, y2: 0.125 });
		expectClose(computeCropRegion({ left: 1, top: 1 }, 4), { x1: 0.875, y1: 0.875, x2: 1, y2: 1 });
	});

	it('falls back to the image centre when the focal point is undefined and zoom > 1', () => {
		expectClose(computeCropRegion(undefined, 2), { x1: 0.25, y1: 0.25, x2: 0.75, y2: 0.75 });
	});
});
