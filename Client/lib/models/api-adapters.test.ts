import { describe, expect, it } from 'vitest';

import {
	mapApiLoginAsset,
	mapApiLoginRule,
	mapApiActiveLeLøginScreenResponse,
	parseActiveLeLøginScreenResponse,
	toSaveRuleRequest
} from './api-adapters.js';

describe('mapApiLoginAsset', () => {
	it('maps login assets when the API returns lower-case asset kinds', () => {
		const asset = mapApiLoginAsset({
			id: 'asset-1',
			name: 'Welcome background',
			kind: 'background',
			altText: 'Welcome skyline',
			greetingText: 'Welcome back',
			logoAssetId: 'logo-1',
			storagePath: '/tmp/background.jpg',
			publicPath: '/login-screen/active.jpg',
			width: 1920,
			height: 1080,
			zoom: 1,
			createdAt: '2026-05-15T17:00:00Z',
			updatedAt: '2026-05-15T17:00:00Z'
		});

		expect(asset.kind).toBe('background');
	});

	// The contract types integers as ["integer", "string"] because the server's JSON options
	// allow reading numbers from strings; the adapter must coerce so the domain stays numeric.
	it('coerces numeric strings for width and height as the contract permits', () => {
		const asset = mapApiLoginAsset({
			id: 'asset-2',
			name: 'Numeric strings',
			kind: 'logo',
			altText: null,
			greetingText: null,
			logoAssetId: null,
			storagePath: '/tmp/logo.svg',
			publicPath: null,
			width: '640',
			height: '480',
			zoom: 1,
			createdAt: '2026-05-15T17:00:00Z',
			updatedAt: '2026-05-15T17:00:00Z'
		});

		expect(asset.width).toBe(640);
		expect(asset.height).toBe(480);
	});

	it('rejects a width that is not a finite integer-like value', () => {
		expect(() =>
			mapApiLoginAsset({
				id: 'asset-3',
				name: 'Corrupted',
				kind: 'logo',
				altText: null,
				greetingText: null,
				logoAssetId: null,
				storagePath: '/tmp/logo.svg',
				publicPath: null,
				width: 'not-a-number',
				height: 480,
				zoom: 1,
				createdAt: '2026-05-15T17:00:00Z',
				updatedAt: '2026-05-15T17:00:00Z'
			})
		).toThrow(/width/);
	});
});

describe('mapApiActiveLeLøginScreenResponse', () => {
	it('maps the active login screen response including focal metadata', () => {
		const response = mapApiActiveLeLøginScreenResponse({
			imageUrl: '/login-screen/active.jpg',
			assetId: 'asset-abc',
			altText: 'Evening skyline',
			greetingText: 'Good evening',
			focalPoint: {
				left: 0.25,
				top: 0.75
			},
			zoom: 1
		});

		expect(response).toEqual({
			imageUrl: '/login-screen/active.jpg',
			assetId: 'asset-abc',
			altText: 'Evening skyline',
			greetingText: 'Good evening',
			focalPoint: {
				left: 0.25,
				top: 0.75
			},
			zoom: 1
		});
	});
});

describe('parseActiveLeLøginScreenResponse', () => {
	it('parses runtime responses and omits nullable optional fields', () => {
		const response = parseActiveLeLøginScreenResponse({
			imageUrl: '/login-screen/active.jpg',
			assetId: 'asset-abc',
			altText: null,
			greetingText: 'Welcome back',
			focalPoint: {
				left: 0.4,
				top: 0.6
			},
			zoom: 1
		});

		expect(response).toEqual({
			imageUrl: '/login-screen/active.jpg',
			assetId: 'asset-abc',
			greetingText: 'Welcome back',
			focalPoint: {
				left: 0.4,
				top: 0.6
			},
			zoom: 1
		});
	});
});

describe('mapApiLoginRule', () => {
	it('maps rules when the API returns lower-case condition contract values', () => {
		const rule = mapApiLoginRule({
			id: 'rule-1',
			name: 'Monday',
			priority: 100,
			enabled: true,
			assetIds: ['asset-1'],
			condition: {
				operator: 'all',
				conditions: [
					{
						id: 'condition-1',
						field: 'weekday',
						operator: 'is',
						values: ['monday']
					}
				]
			}
		});

		expect(rule).toMatchObject({
			id: 'rule-1',
			priority: 100,
			assetIds: ['asset-1'],
			condition: {
				operator: 'all',
				conditions: [{ field: 'weekday', operator: 'is', values: ['monday'] }]
			}
		});
	});

	it('maps a rule holding multiple images (shown at random when it matches)', () => {
		const rule = mapApiLoginRule({
			id: 'rule-multi',
			name: 'Wednesday pool',
			priority: 50,
			enabled: true,
			assetIds: ['asset-a', 'asset-b', 'asset-c'],
			condition: {
				operator: 'all',
				conditions: [{ id: 'c1', field: 'weekday', operator: 'is', values: ['wednesday'] }]
			}
		});

		expect(rule.assetIds).toEqual(['asset-a', 'asset-b', 'asset-c']);
		expect(rule.condition.operator).toBe('all');
	});
});

describe('toSaveRuleRequest', () => {
	// The wire contract and the domain use the same lowercase values; serialisation must
	// not re-case them — the PascalCase the old client sent only survived because the
	// server's converters read case-insensitively.
	it('serialises a rule with multiple images back to the wire contract', () => {
		const request = toSaveRuleRequest({
			id: 'rule-multi',
			name: 'Pool',
			priority: 50,
			enabled: true,
			assetIds: ['asset-a', 'asset-b'],
			condition: { operator: 'all', conditions: [] }
		});

		expect(request.assetIds).toEqual(['asset-a', 'asset-b']);
		expect(request.condition.operator).toBe('all');
	});
});
