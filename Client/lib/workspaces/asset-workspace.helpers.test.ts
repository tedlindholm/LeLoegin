import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { computeFocalPointFromDrag } from './focal-point-drag.js';

/** Whether `later` appears somewhere after `earlier` in `text`. */
const appearsInOrder = (text: string, earlier: string, later: string): boolean => {
	const start = text.indexOf(earlier);
	return start >= 0 && text.indexOf(later, start + earlier.length) >= 0;
};

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const helperFilePath = resolve(currentDirectory, 'asset-workspace.helpers.ts');
const zoomControlsFilePath = resolve(currentDirectory, 'asset-zoom-controls.ts');

const wideImageOnTallContainer = {
	image: { width: 2000, height: 1000 },
	container: { width: 400, height: 400 }
};

describe('computeFocalPointFromDrag', () => {
	it('shifts focal point along the overflowing axis only', () => {
		// image 2000x1000 cover-scaled to 400 height → 800x400, overflow 400px wide.
		// startLeft 0.5 - 100/400 = 0.25.
		const result = computeFocalPointFromDrag({
			...wideImageOnTallContainer,
			startFocalPoint: { left: 0.5, top: 0.5 },
			deltaX: 100,
			deltaY: 100
		});
		expect(result.top).toBe(0.5);
		expect(result.left).toBeCloseTo(0.25, 5);
	});

	it('clamps to the 0–1 range when the drag exceeds available overflow', () => {
		const result = computeFocalPointFromDrag({
			...wideImageOnTallContainer,
			startFocalPoint: { left: 0.5, top: 0.5 },
			deltaX: 9999,
			deltaY: 9999
		});
		expect(result.left).toBe(0);
		expect(result.top).toBe(0.5);
	});
});

describe('computeFocalPointFromDrag when zoomed', () => {
	it('unlocks the Y axis for a wide image at zoom > 1 with 1:1 painted-height panning', () => {
		// image 2000x1000 cover-scaled to 800x400 in the container.
		// At zoom=2, crop-preview paints the image 1600x800 and centres the crop window,
		// so shifting fp.top by Δfp moves the image by 800 * Δfp pixels.
		// top = 0.5 - (-100) / 800 = 0.625.
		const result = computeFocalPointFromDrag({
			...wideImageOnTallContainer,
			startFocalPoint: { left: 0.5, top: 0.5 },
			deltaX: 0,
			deltaY: -100,
			zoom: 2
		});
		expect(result.left).toBe(0.5);
		expect(result.top).toBeCloseTo(0.625, 5);
	});

	it('scales drag sensitivity with painted width at zoom > 1', () => {
		// At zoom=2, paintedW = 800 * 2 = 1600.
		// left = 0.5 - 100 / 1600 = 0.4375.
		const result = computeFocalPointFromDrag({
			...wideImageOnTallContainer,
			startFocalPoint: { left: 0.5, top: 0.5 },
			deltaX: 100,
			deltaY: 0,
			zoom: 2
		});
		expect(result.left).toBeCloseTo(0.5 - 100 / 1600, 5);
	});
});

describe('computeFocalPointFromDrag alignment with crop-preview', () => {
	it('moves the crop-preview painted image by exactly deltaX/deltaY container pixels', () => {
		const image = { width: 2000, height: 1000 };
		const container = { width: 400, height: 400 };
		const zoom = 2.5;
		const startFocalPoint = { left: 0.5, top: 0.5 };
		const deltaX = 75;
		const deltaY = -40;

		const next = computeFocalPointFromDrag({
			image,
			container,
			startFocalPoint,
			deltaX,
			deltaY,
			zoom
		});

		// Mirror crop-preview.ts maths: coverScale = zoom * max(W/imgW, H/imgH)
		const coverScale =
			zoom * Math.max(container.width / image.width, container.height / image.height);
		const paintedW = image.width * coverScale;
		const paintedH = image.height * coverScale;
		// When focal point is unclamped inside [half, 1-half], cropCentre === focalPoint,
		// and image left/top edge in container is container/2 - cropCentre * paintedSize.
		const edgeBeforeX = container.width / 2 - startFocalPoint.left * paintedW;
		const edgeAfterX = container.width / 2 - next.left * paintedW;
		const edgeBeforeY = container.height / 2 - startFocalPoint.top * paintedH;
		const edgeAfterY = container.height / 2 - next.top * paintedH;

		expect(edgeAfterX - edgeBeforeX).toBeCloseTo(deltaX, 5);
		expect(edgeAfterY - edgeBeforeY).toBeCloseTo(deltaY, 5);
	});
});

describe('computeFocalPointFromDrag with unusable input', () => {
	it('returns the starting focal point when sizes are invalid', () => {
		const start = { left: 0.25, top: 0.75 };
		const result = computeFocalPointFromDrag({
			image: { width: 0, height: 0 },
			container: { width: 400, height: 400 },
			startFocalPoint: start,
			deltaX: 50,
			deltaY: 50
		});
		expect(result).toEqual(start);
	});

	it('returns the starting focal point when deltas are non-finite', () => {
		const start = { left: 0.4, top: 0.6 };
		const result = computeFocalPointFromDrag({
			...wideImageOnTallContainer,
			startFocalPoint: start,
			deltaX: Number.NaN,
			deltaY: 50
		});
		expect(result).toEqual(start);
	});

	it('treats non-finite zoom as zoom=1 instead of propagating NaN', () => {
		// With zoom=1 on a wide image the Y axis is locked and X overflow is 400.
		const result = computeFocalPointFromDrag({
			...wideImageOnTallContainer,
			startFocalPoint: { left: 0.5, top: 0.5 },
			deltaX: 100,
			deltaY: 100,
			zoom: Number.NaN
		});
		expect(result.left).toBeCloseTo(0.25, 5);
		expect(result.top).toBe(0.5);
		expect(Number.isFinite(result.left)).toBe(true);
		expect(Number.isFinite(result.top)).toBe(true);
	});
});

describe('asset workspace helper rendering', () => {
	it('builds preview overlay controls and workspace body with DOM nodes', async () => {
		const source =
			(await readFile(helperFilePath, 'utf8')) + (await readFile(zoomControlsFilePath, 'utf8'));

		expect(source).toContain('export const buildWorkspaceBody =');
		expect(source).toContain('cloneTemplate(');
		expect(source).toContain("document.createElement('");
		expect(source).toContain('id="preview-overlay"');
		expect(source).toContain('id="asset-greeting-inline"');
		expect(source).toContain('id="asset-logo-picker-button"');
		expect(source).toContain('id="asset-zoom-in"');
		expect(source).toContain('id="asset-zoom-out"');
		expect(
			appearsInOrder(source, '<uui-action-bar', '<uui-button id="asset-logo-picker-button"')
		).toBe(true);
		expect(appearsInOrder(source, '<uui-action-bar', '<uui-button id="asset-zoom-out"')).toBe(true);
		expect(source).not.toContain('<button id="asset-logo-picker-button"');
		expect(source).not.toContain('<button id="asset-zoom-');
		expect(source).not.toContain('renderWorkspaceBodyMarkup');
		expect(source).not.toContain('renderLoadedWorkspaceMarkup');
		expect(source).not.toContain('id="asset-logo-picker-popover"');
		expect(source).not.toContain('id="asset-logo-asset"');
		expect(source).not.toContain('const greetingTextPlaceholder');
		expect(source).not.toContain('placeholder="${greetingTextPlaceholder}"');
		expect(source).not.toContain('<span class="preview-control-label">${greetingTextLabel}</span>');
		expect(source).not.toContain('uui-select');
	});
});
