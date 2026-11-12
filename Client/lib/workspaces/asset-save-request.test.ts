import { describe, expect, it } from 'vitest';
import { toAssetSaveRequest, type AssetSaveDraft } from './asset-save-request.js';

const background = {
	name: 'Skyline',
	kind: 'background',
	altText: 'City skyline',
	greetingText: 'Welcome back',
	logoAssetId: 'logo-1',
	focalPoint: { left: 0.3, top: 0.6 },
	zoom: 2
} satisfies AssetSaveDraft;

describe('toAssetSaveRequest', () => {
	it('sends the complete background state', () => {
		expect(toAssetSaveRequest(background)).toEqual({
			name: 'Skyline',
			altText: 'City skyline',
			greetingText: 'Welcome back',
			logoAssetId: 'logo-1',
			focalPoint: { left: 0.3, top: 0.6 },
			zoom: 2
		});
	});

	it('sends null for background fields that are not set', () => {
		expect(toAssetSaveRequest({ name: 'Plain', kind: 'background' })).toEqual({
			name: 'Plain',
			altText: null,
			greetingText: null,
			logoAssetId: null,
			focalPoint: null,
			zoom: null
		});
	});

	it('nulls the background-only fields for a logo', () => {
		expect(toAssetSaveRequest({ ...background, kind: 'logo' })).toEqual({
			name: 'Skyline',
			altText: 'City skyline',
			greetingText: null,
			logoAssetId: null,
			focalPoint: null,
			zoom: null
		});
	});
});
