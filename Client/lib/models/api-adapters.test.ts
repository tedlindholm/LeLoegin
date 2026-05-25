import { describe, expect, it } from 'vitest';

import {
	mapApiLoginAsset,
	mapApiLoginRule,
	mapApiActiveLeLøginScreenResponse,
	parseActiveLeLøginScreenResponse
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
				top: 0.75,
			},
			zoom: 1,
		});

		expect(response).toEqual({
			imageUrl: '/login-screen/active.jpg',
			assetId: 'asset-abc',
			altText: 'Evening skyline',
			greetingText: 'Good evening',
			focalPoint: {
				left: 0.25,
				top: 0.75,
			},
			zoom: 1,
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
				top: 0.6,
			},
			zoom: 1,
		});

		expect(response).toEqual({
			imageUrl: '/login-screen/active.jpg',
			assetId: 'asset-abc',
			greetingText: 'Welcome back',
			focalPoint: {
				left: 0.4,
				top: 0.6,
			},
			zoom: 1,
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
			assetId: 'asset-1',
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
			assetId: 'asset-1',
			condition: {
				operator: 'all',
				conditions: [{ field: 'weekday', operator: 'is', values: ['monday'] }]
			}
		});
	});
});