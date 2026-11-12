import { describe, expect, it } from 'vitest';
import { isConditionChangeEvent } from './rule-workspace.helpers.js';

const conditionEvent = (detail: unknown) => new CustomEvent('condition-change', { detail });

describe('isConditionChangeEvent', () => {
	it('accepts an event carrying a condition group', () => {
		expect(isConditionChangeEvent(conditionEvent({ operator: 'any', conditions: [] }))).toBe(true);
	});

	it.each([null, 'all', { operator: 'some', conditions: [] }, { operator: 'all' }])(
		'rejects an event whose detail is not a condition group: %j',
		(detail) => {
			expect(isConditionChangeEvent(conditionEvent(detail))).toBe(false);
		}
	);

	it('rejects a plain event', () => {
		expect(isConditionChangeEvent(new Event('condition-change'))).toBe(false);
	});
});
