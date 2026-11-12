import { expect, it } from 'vitest';
import { assetDeletionImpact } from './asset-deletion-impact.js';

it('separates rules that will be disabled from rules that only lose the image', () => {
	const rules = [
		{ name: 'Christmas', enabled: true, assetIds: ['asset-deleted'] },
		{ name: 'Mondays', enabled: true, assetIds: ['asset-other', 'ASSET-DELETED'] },
		{ name: 'Old campaign', enabled: false, assetIds: ['asset-deleted'] },
		{ name: 'Unrelated', enabled: true, assetIds: ['asset-other'] }
	];

	expect(assetDeletionImpact(rules, 'asset-deleted')).toEqual({
		disabledRules: ['Christmas'],
		reducedRules: ['Mondays', 'Old campaign']
	});
});
