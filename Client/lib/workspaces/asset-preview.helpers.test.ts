import { describe, expect, it } from 'vitest';
import { buildAssetPreviewCustomisation } from './asset-preview.helpers.js';

const draft = {
	imageUrl: 'blob:image',
	greetingText: 'Welcome back',
	logoUrl: 'blob:logo',
	focalPoint: { left: 0.3, top: 0.6 },
	zoom: 1.5,
	imageWidth: 1920,
	imageHeight: 1080
};

describe('buildAssetPreviewCustomisation', () => {
	it('shows only the preview frame when no background asset is loaded', () => {
		expect(buildAssetPreviewCustomisation(undefined, 'Preview only')).toEqual({
			mode: 'preview',
			previewHeight: '100%',
			previewNote: 'Preview only'
		});
	});

	it('carries the background draft and hides the real greeting', () => {
		expect(buildAssetPreviewCustomisation(draft, 'Preview only')).toEqual({
			...draft,
			hideGreeting: true,
			mode: 'preview',
			previewHeight: '100%',
			previewNote: 'Preview only'
		});
	});

	it('leaves out missing values and a zoom that does not enlarge the image', () => {
		const customisation = buildAssetPreviewCustomisation(
			{
				...draft,
				greetingText: undefined,
				logoUrl: undefined,
				focalPoint: undefined,
				zoom: 1,
				imageWidth: undefined,
				imageHeight: undefined
			},
			'Preview only'
		);

		expect(Object.keys(customisation).sort()).toEqual(
			['hideGreeting', 'imageUrl', 'mode', 'previewHeight', 'previewNote'].sort()
		);
	});
});
