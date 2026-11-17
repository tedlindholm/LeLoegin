import { describe, expect, it } from 'vitest';
import {
	buildRuleListShadowMarkup,
	reorderRuleIds,
	swapAdjacentRuleIds
} from './rule-list-workspace.helpers.js';

describe('swapAdjacentRuleIds', () => {
	it('swaps a rule up or down without mutating the source array', () => {
		const ids = ['r1', 'r2', 'r3'];
		expect(swapAdjacentRuleIds(ids, 'r2', -1)).toEqual(['r2', 'r1', 'r3']);
		expect(swapAdjacentRuleIds(ids, 'r2', 1)).toEqual(['r1', 'r3', 'r2']);
		expect(ids).toEqual(['r1', 'r2', 'r3']);
	});

	it('returns undefined at list boundaries or for unknown ids', () => {
		expect(swapAdjacentRuleIds(['r1', 'r2'], 'r1', -1)).toBeUndefined();
		expect(swapAdjacentRuleIds(['r1', 'r2'], 'r2', 1)).toBeUndefined();
		expect(swapAdjacentRuleIds(['r1', 'r2'], 'missing', 1)).toBeUndefined();
	});
});

describe('reorderRuleIds', () => {
	it('moves the dragged rule to the target position', () => {
		expect(reorderRuleIds(['r1', 'r2', 'r3'], 'r1', 'r3')).toEqual(['r2', 'r3', 'r1']);
		expect(reorderRuleIds(['r1', 'r2', 'r3'], 'r3', 'r1')).toEqual(['r3', 'r1', 'r2']);
	});

	it('returns undefined when source equals target or an id is missing', () => {
		expect(reorderRuleIds(['r1', 'r2'], 'r1', 'r1')).toBeUndefined();
		expect(reorderRuleIds(['r1', 'r2'], 'missing', 'r1')).toBeUndefined();
		expect(reorderRuleIds(['r1', 'r2'], 'r1', 'missing')).toBeUndefined();
	});
});

describe('buildRuleListShadowMarkup', () => {
	it('escapes headline and create button label in the shadow markup', () => {
		const escape = (v: string) =>
			v
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;');
		const markup = buildRuleListShadowMarkup('Rules <1>', 'Create "Rule"', '/create', escape);

		expect(markup).toContain('headline="Rules &lt;1&gt;"');
		expect(markup).toContain('label="Create &quot;Rule&quot;"');
		expect(markup).toContain('href="/create"');
	});
});
